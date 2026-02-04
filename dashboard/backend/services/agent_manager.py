"""Agent connection and state management."""

import asyncio
import json
from datetime import datetime
from typing import Optional, TYPE_CHECKING

import websockets
from websockets.exceptions import ConnectionClosed

from config import (
    WS_CONNECT_TIMEOUT,
    WS_RECV_TIMEOUT,
    PROMPT_TIMEOUT,
    HEARTBEAT_PING_TIMEOUT,
    REGISTRY_PATH,
)
from models import AgentState, AgentSummary, RegistryEntry

if TYPE_CHECKING:
    from services.broadcast import BroadcastService


class AgentConnection:
    """Manages WebSocket connection to a single agent."""

    def __init__(
        self,
        instance_id: str,
        port: int,
        entry: RegistryEntry,
        manager: "AgentManager",
    ):
        self.instance_id = instance_id
        self.port = port
        self.entry = entry
        self.manager = manager
        self.ws: Optional[websockets.WebSocketClientProtocol] = None
        self._listening = False
        self._pending_responses: dict[str, asyncio.Future] = {}

    async def connect(self) -> bool:
        """Connect to agent WebSocket."""
        try:
            self.ws = await asyncio.wait_for(
                websockets.connect(f"ws://localhost:{self.port}"),
                timeout=WS_CONNECT_TIMEOUT,
            )

            # Read initial config
            initial = await asyncio.wait_for(self.ws.recv(), timeout=WS_RECV_TIMEOUT)
            config = json.loads(initial)

            now = datetime.now().isoformat()
            self.manager.agents[self.instance_id] = {
                "connected": True,
                "config": config,
                "last_heartbeat": now,
                "health": "healthy",
            }

            self.manager.broadcast.log_activity(
                "agent_connected",
                self.port,
                self.instance_id,
            )

            # Broadcast full agent data so new agents appear in dashboard
            project_path = self.entry.get("projectPath", "")
            await self.manager.broadcast.broadcast_agent_added({
                "instance_id": self.instance_id,
                "port": self.port,
                "project_path": project_path,
                "project_name": project_path.split("/")[-1] if project_path else "Unknown",
                "capabilities": self.entry.get("capabilities", []),
                "connected": True,
                "health": "healthy",
                "last_heartbeat": now,
            })

            return True

        except Exception as e:
            print(f"Failed to connect to agent {self.port}: {e}")
            self.manager.agents[self.instance_id] = {
                "connected": False,
                "health": "disconnected",
            }
            return False

    async def disconnect(self) -> None:
        """Disconnect from agent."""
        self._listening = False
        if self.ws:
            try:
                await self.ws.close()
            except Exception:
                pass
        if self.instance_id in self.manager.agents:
            self.manager.agents[self.instance_id]["connected"] = False
            self.manager.agents[self.instance_id]["health"] = "disconnected"

    async def heartbeat(self) -> bool:
        """Send ping and await pong to verify agent is responsive."""
        if not self.ws or not self.manager.agents.get(self.instance_id, {}).get("connected"):
            return False

        try:
            pong_waiter = await self.ws.ping()
            await asyncio.wait_for(pong_waiter, timeout=HEARTBEAT_PING_TIMEOUT)

            now = datetime.now().isoformat()
            self.manager.agents[self.instance_id]["last_heartbeat"] = now
            self.manager.agents[self.instance_id]["health"] = "healthy"
            return True
        except Exception:
            return False

    async def listen(self) -> None:
        """Listen for messages from agent."""
        if not self.ws:
            return

        self._listening = True
        try:
            while self._listening:
                try:
                    message = await asyncio.wait_for(self.ws.recv(), timeout=1)
                    data = json.loads(message)
                    msg_type = data.get("type", "")

                    if msg_type == "copilotPromptResult":
                        self.manager.broadcast.log_activity(
                            "prompt_response",
                            self.port,
                            self.instance_id,
                            prompt=data.get("prompt", "")[:100],
                            response=data.get("content", "")[:300],
                            status=data.get("status"),
                        )

                        # Resolve pending future
                        request_id = data.get("request_id")
                        if request_id and request_id in self._pending_responses:
                            future = self._pending_responses.pop(request_id)
                            if not future.done():
                                future.set_result(data)
                        elif self.instance_id in self._pending_responses:
                            future = self._pending_responses.pop(self.instance_id)
                            if not future.done():
                                future.set_result(data)

                    # Handle command responses (newAgentSession, etc.)
                    elif msg_type in self._pending_responses:
                        future = self._pending_responses.pop(msg_type)
                        if not future.done():
                            future.set_result(data)

                except asyncio.TimeoutError:
                    continue

        except ConnectionClosed:
            self.manager.agents[self.instance_id]["connected"] = False
            self.manager.agents[self.instance_id]["health"] = "disconnected"
            self.manager.broadcast.log_activity(
                "agent_disconnected",
                self.port,
                self.instance_id,
            )
            await self.manager.broadcast.broadcast_agent_delta(self.instance_id, {
                "connected": False,
                "health": "disconnected",
            })

    async def send_prompt(self, prompt: str) -> dict:
        """Send prompt and wait for response."""
        if not self.ws or not self.manager.agents.get(self.instance_id, {}).get("connected"):
            return {"error": "Not connected"}

        try:
            self.manager.broadcast.log_activity(
                "prompt_sent",
                self.port,
                self.instance_id,
                prompt=prompt[:100],
            )

            future: asyncio.Future = asyncio.get_event_loop().create_future()
            self._pending_responses[self.instance_id] = future

            await self.ws.send(json.dumps({
                "type": "copilotPrompt",
                "prompt": prompt,
            }))

            result = await asyncio.wait_for(future, timeout=PROMPT_TIMEOUT)
            return result

        except asyncio.TimeoutError:
            self._pending_responses.pop(self.instance_id, None)
            return {"error": "Timeout"}
        except Exception as e:
            self._pending_responses.pop(self.instance_id, None)
            return {"error": str(e)}

    async def send_command(self, command_type: str, timeout: float = 5.0) -> dict:
        """Send a command and wait for response."""
        if not self.ws or not self.manager.agents.get(self.instance_id, {}).get("connected"):
            return {"error": "Not connected"}

        try:
            future: asyncio.Future = asyncio.get_event_loop().create_future()
            self._pending_responses[command_type] = future

            await self.ws.send(json.dumps({"type": command_type}))

            result = await asyncio.wait_for(future, timeout=timeout)
            return result

        except asyncio.TimeoutError:
            self._pending_responses.pop(command_type, None)
            return {"error": "Timeout", "type": command_type}
        except Exception as e:
            self._pending_responses.pop(command_type, None)
            return {"error": str(e), "type": command_type}


class AgentManager:
    """Manages all agent connections and state."""

    def __init__(self, broadcast: "BroadcastService"):
        self.broadcast = broadcast
        self.agents: dict[str, AgentState] = {}
        self.connections: dict[str, AgentConnection] = {}

    def read_registry(self) -> dict[str, RegistryEntry]:
        """Read the centralized registry."""
        if not REGISTRY_PATH.exists():
            return {}
        try:
            with open(REGISTRY_PATH) as f:
                return json.load(f)
        except Exception:
            return {}

    def get_agents_summary(self) -> list[AgentSummary]:
        """Get summary of all agents."""
        registry = self.read_registry()
        result = []

        for instance_id, entry in registry.items():
            project_path = entry.get("projectPath", "")
            agent_state = self.agents.get(instance_id, {})

            result.append({
                "instance_id": instance_id,
                "port": entry.get("port"),
                "project_path": project_path,
                "project_name": project_path.split("/")[-1] if project_path else "Unknown",
                "capabilities": entry.get("capabilities", []),
                "connected": agent_state.get("connected", False),
                "last_heartbeat": agent_state.get("last_heartbeat"),
                "health": agent_state.get("health", "disconnected"),
            })

        return result

    def get_connection(self, instance_id: str) -> Optional[AgentConnection]:
        """Get connection for an agent."""
        return self.connections.get(instance_id)

    def get_connected_agent(self) -> Optional[AgentConnection]:
        """Get any connected agent."""
        for conn in self.connections.values():
            if self.agents.get(conn.instance_id, {}).get("connected"):
                return conn
        return None

    def get_agent_for_project(self, project_path: str) -> Optional[AgentConnection]:
        """Get a connected agent that matches the given project path."""
        registry = self.read_registry()
        for instance_id, entry in registry.items():
            if entry.get("projectPath") == project_path:
                conn = self.connections.get(instance_id)
                if conn and self.agents.get(instance_id, {}).get("connected"):
                    return conn
        return None

    async def connect_agent(self, instance_id: str, entry: RegistryEntry) -> bool:
        """Create and connect to an agent."""
        port = entry.get("port")
        if not port:
            return False

        conn = AgentConnection(instance_id, port, entry, self)
        self.connections[instance_id] = conn

        if await conn.connect():
            asyncio.create_task(conn.listen())
            return True
        return False

    async def disconnect_agent(self, instance_id: str) -> None:
        """Disconnect and remove an agent."""
        if instance_id in self.connections:
            await self.connections[instance_id].disconnect()
            del self.connections[instance_id]
        if instance_id in self.agents:
            del self.agents[instance_id]
