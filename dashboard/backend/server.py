#!/usr/bin/env python3
"""
Multi-Agent Dashboard Backend

FastAPI server that:
- Connects to all agents via WebSocket
- Aggregates events and broadcasts to dashboard clients
- Handles prompt routing
"""

import asyncio
import json
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import websockets
from websockets.exceptions import ConnectionClosed

app = FastAPI(title="Multi-Agent Dashboard")

# CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registry path
REGISTRY_PATH = Path.home() / ".citi-agent" / "registry.json"

# Flows directory
FLOWS_DIR = Path.home() / ".citi-agent" / "flows"

# Connected dashboard clients
dashboard_clients: list[WebSocket] = []

# Agent states and connections
agents: dict[str, dict] = {}
agent_connections: dict[str, "AgentConnection"] = {}

# Activity log
activity_log: list[dict] = []
MAX_ACTIVITY = 100


def read_registry() -> dict:
    """Read the centralized registry."""
    if not REGISTRY_PATH.exists():
        return {}
    try:
        with open(REGISTRY_PATH) as f:
            return json.load(f)
    except Exception:
        return {}


def get_agents_summary() -> list[dict]:
    """Get summary of all agents."""
    registry = read_registry()
    result = []

    for instance_id, entry in registry.items():
        project_path = entry.get("projectPath", "")
        agent_state = agents.get(instance_id, {})

        result.append({
            "instance_id": instance_id,
            "port": entry.get("port"),
            "project_path": project_path,
            "project_name": project_path.split("/")[-1] if project_path else "Unknown",
            "role": entry.get("role"),
            "capabilities": entry.get("capabilities", []),
            "agent_name": entry.get("agentName"),
            "connected": agent_state.get("connected", False),
        })

    return result


async def broadcast_to_dashboards(message: dict):
    """Send message to all dashboard clients."""
    if not dashboard_clients:
        return

    msg_str = json.dumps(message)
    disconnected = []

    for client in dashboard_clients:
        try:
            await client.send_text(msg_str)
        except Exception:
            disconnected.append(client)

    for client in disconnected:
        if client in dashboard_clients:
            dashboard_clients.remove(client)


def log_activity(event_type: str, port: int, instance_id: str, **data):
    """Log activity and broadcast."""
    event = {
        "timestamp": datetime.now().isoformat(),
        "event_type": event_type,
        "port": port,
        "instance_id": instance_id,
        **data,
    }
    activity_log.insert(0, event)
    if len(activity_log) > MAX_ACTIVITY:
        activity_log.pop()

    asyncio.create_task(broadcast_to_dashboards({"type": "activity", "event": event}))


class AgentConnection:
    """Manages connection to a single agent."""

    def __init__(self, instance_id: str, port: int, entry: dict):
        self.instance_id = instance_id
        self.port = port
        self.entry = entry
        self.ws: Optional[websockets.WebSocketClientProtocol] = None
        self._listening = False
        self._pending_responses: dict[str, asyncio.Future] = {}

    async def connect(self) -> bool:
        """Connect to agent WebSocket."""
        try:
            self.ws = await asyncio.wait_for(
                websockets.connect(f"ws://localhost:{self.port}"),
                timeout=5,
            )

            # Read initial config
            initial = await asyncio.wait_for(self.ws.recv(), timeout=5)
            config = json.loads(initial)

            agents[self.instance_id] = {
                "connected": True,
                "config": config,
            }

            log_activity(
                "agent_connected",
                self.port,
                self.instance_id,
                role=self.entry.get("role"),
            )

            await broadcast_to_dashboards({
                "type": "agents_update",
                "agents": get_agents_summary(),
            })

            return True

        except Exception as e:
            print(f"Failed to connect to agent {self.port}: {e}")
            agents[self.instance_id] = {"connected": False}
            return False

    async def disconnect(self):
        """Disconnect from agent."""
        self._listening = False
        if self.ws:
            try:
                await self.ws.close()
            except Exception:
                pass
        if self.instance_id in agents:
            agents[self.instance_id]["connected"] = False

    async def listen(self):
        """Listen for messages from agent."""
        if not self.ws:
            return

        self._listening = True
        try:
            while self._listening:
                try:
                    message = await asyncio.wait_for(self.ws.recv(), timeout=1)
                    data = json.loads(message)

                    # Handle prompt results
                    if data.get("type") == "copilotPromptResult":
                        log_activity(
                            "prompt_response",
                            self.port,
                            self.instance_id,
                            role=self.entry.get("role"),
                            prompt=data.get("prompt", "")[:100],
                            response=data.get("content", "")[:300],
                            status=data.get("status"),
                        )

                        # Resolve pending future if any
                        if self.instance_id in self._pending_responses:
                            future = self._pending_responses.pop(self.instance_id)
                            if not future.done():
                                future.set_result(data)

                except asyncio.TimeoutError:
                    continue

        except ConnectionClosed:
            agents[self.instance_id]["connected"] = False
            log_activity(
                "agent_disconnected",
                self.port,
                self.instance_id,
                role=self.entry.get("role"),
            )
            await broadcast_to_dashboards({
                "type": "agents_update",
                "agents": get_agents_summary(),
            })

    async def send_prompt(self, prompt: str) -> dict:
        """Send prompt and wait for response."""
        if not self.ws or not agents.get(self.instance_id, {}).get("connected"):
            return {"error": "Not connected"}

        try:
            log_activity(
                "prompt_sent",
                self.port,
                self.instance_id,
                role=self.entry.get("role"),
                prompt=prompt[:100],
            )

            # Create future for response
            future: asyncio.Future = asyncio.get_event_loop().create_future()
            self._pending_responses[self.instance_id] = future

            await self.ws.send(json.dumps({
                "type": "copilotPrompt",
                "prompt": prompt,
            }))

            # Wait for "executing" status
            response = await asyncio.wait_for(self.ws.recv(), timeout=10)
            data = json.loads(response)

            if data.get("status") == "executing":
                # Wait for actual result
                result = await asyncio.wait_for(future, timeout=120)
                return result
            else:
                return data

        except asyncio.TimeoutError:
            self._pending_responses.pop(self.instance_id, None)
            return {"error": "Timeout"}
        except Exception as e:
            self._pending_responses.pop(self.instance_id, None)
            return {"error": str(e)}


async def monitor_registry():
    """Monitor registry for agent changes."""
    known_instances: set[str] = set()

    while True:
        try:
            registry = read_registry()
            current = set(registry.keys())

            # New agents
            for instance_id in current - known_instances:
                entry = registry[instance_id]
                port = entry.get("port")
                if port:
                    conn = AgentConnection(instance_id, port, entry)
                    agent_connections[instance_id] = conn
                    if await conn.connect():
                        asyncio.create_task(conn.listen())

            # Removed agents
            for instance_id in known_instances - current:
                if instance_id in agent_connections:
                    await agent_connections[instance_id].disconnect()
                    del agent_connections[instance_id]
                if instance_id in agents:
                    del agents[instance_id]

            # Update existing agents' registry data
            for instance_id in current & known_instances:
                if instance_id in agent_connections:
                    conn = agent_connections[instance_id]
                    conn.entry = registry[instance_id]

                    # Try reconnecting if disconnected
                    if not agents.get(instance_id, {}).get("connected"):
                        if await conn.connect():
                            asyncio.create_task(conn.listen())

            if current != known_instances:
                await broadcast_to_dashboards({
                    "type": "agents_update",
                    "agents": get_agents_summary(),
                })

            known_instances = current

        except Exception as e:
            print(f"Monitor error: {e}")

        await asyncio.sleep(2)


async def spawn_ide_directly(project_path: str, role: str = None, capabilities: list = None) -> dict:
    """Spawn IDE directly using system commands."""
    import subprocess
    import os
    import sys

    print(f"[SPAWN] spawn_ide_directly called with path: {project_path}", flush=True)
    sys.stdout.flush()

    if not os.path.isdir(project_path):
        print(f"[SPAWN] Path does not exist: {project_path}")
        return {"error": f"Path does not exist: {project_path}"}

    # Use AppleScript to tell IntelliJ to open the project
    # This mimics what happens when opening from within the IDE
    applescript = f'''
    tell application "IntelliJ IDEA CE"
        activate
        open "{project_path}"
    end tell
    '''

    try:
        print(f"[SPAWN] Trying AppleScript approach", flush=True)
        proc = subprocess.Popen(
            ["osascript", "-e", applescript],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        stdout, stderr = proc.communicate(timeout=10)

        if proc.returncode == 0:
            print(f"[SPAWN] AppleScript succeeded", flush=True)
            log_activity(
                "agent_spawning",
                0,
                "dashboard",
                project_path=project_path,
                role=role,
            )
            return {
                "status": "launched",
                "project_path": project_path,
                "role": role,
                "message": "IDE launched. Agent will appear when ready.",
            }
        else:
            print(f"[SPAWN] AppleScript failed: {stderr.decode()}", flush=True)
    except Exception as e:
        print(f"[SPAWN] AppleScript error: {e}", flush=True)

    # Fallback to direct binary
    idea_binary = "/Applications/IntelliJ IDEA CE.app/Contents/MacOS/idea"
    if not os.path.exists(idea_binary):
        idea_binary = "/Applications/IntelliJ IDEA.app/Contents/MacOS/idea"

    env = os.environ.copy()
    commands = [
        ([idea_binary, project_path], env),
    ]

    for cmd, cmd_env in commands:
        try:
            print(f"[SPAWN] Trying command: {cmd}", flush=True)
            print(f"[SPAWN] With IDEA_VM_OPTIONS: {cmd_env.get('IDEA_VM_OPTIONS', 'none')}", flush=True)
            proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=cmd_env)
            # Wait briefly to see if command fails immediately
            try:
                proc.wait(timeout=2)
                if proc.returncode != 0:
                    stderr = proc.stderr.read().decode() if proc.stderr else ""
                    print(f"[SPAWN] Command returned {proc.returncode}: {stderr}", flush=True)
                    continue
            except subprocess.TimeoutExpired:
                # Process is still running, which means it launched successfully
                pass

            print(f"[SPAWN] Command succeeded: {cmd}", flush=True)
            log_activity(
                "agent_spawning",
                0,
                "dashboard",
                project_path=project_path,
                role=role,
            )
            return {
                "status": "launched",
                "project_path": project_path,
                "role": role,
                "message": "IDE launched. Agent will appear when ready.",
            }
        except FileNotFoundError as e:
            print(f"[SPAWN] Command not found: {cmd} - {e}", flush=True)
            continue
        except Exception as e:
            print(f"[SPAWN] Command failed: {cmd} - {e}", flush=True)
            continue

    print("[SPAWN] All commands failed", flush=True)
    return {"error": "Failed to launch IDE"}


async def spawn_via_agent(conn: AgentConnection, project_path: str, role: str = None, capabilities: list = None) -> dict:
    """Spawn a new agent via an existing connected agent."""
    # Always use direct spawn to avoid WebSocket recv conflicts
    # The listen loop is already consuming messages from the agent connection
    print(f"[SPAWN] spawn_via_agent: using direct spawn for {project_path}")
    return await spawn_ide_directly(project_path, role, capabilities)


@app.on_event("startup")
async def startup():
    """Start background tasks."""
    asyncio.create_task(monitor_registry())


@app.get("/api/agents")
async def get_agents():
    """Get all agents."""
    return get_agents_summary()


@app.get("/api/activity")
async def get_activity():
    """Get activity log."""
    return activity_log


# ============ Flow Management ============

def ensure_flows_dir():
    """Ensure flows directory exists."""
    FLOWS_DIR.mkdir(parents=True, exist_ok=True)


@app.get("/api/flows")
async def list_flows():
    """List all saved flows."""
    ensure_flows_dir()
    flows = []
    for file in FLOWS_DIR.glob("*.json"):
        try:
            with open(file) as f:
                data = json.load(f)
                flows.append({
                    "name": file.stem,
                    "description": data.get("description", ""),
                    "templateId": data.get("templateId"),
                    "nodeCount": len(data.get("nodes", [])),
                    "edgeCount": len(data.get("edges", [])),
                    "createdAt": data.get("createdAt"),
                    "updatedAt": data.get("updatedAt"),
                })
        except Exception:
            continue
    return sorted(flows, key=lambda x: x.get("updatedAt", ""), reverse=True)


@app.get("/api/flows/{name}")
async def get_flow(name: str):
    """Get a specific flow by name."""
    ensure_flows_dir()
    file_path = FLOWS_DIR / f"{name}.json"
    if not file_path.exists():
        return {"error": "Flow not found"}
    try:
        with open(file_path) as f:
            return json.load(f)
    except Exception as e:
        return {"error": str(e)}


@app.post("/api/flows")
async def save_flow(flow: dict):
    """Save a flow."""
    from fastapi import Request
    ensure_flows_dir()

    name = flow.get("name")
    if not name:
        return {"error": "Flow name is required"}

    # Sanitize filename
    safe_name = "".join(c for c in name if c.isalnum() or c in "-_ ").strip()
    if not safe_name:
        return {"error": "Invalid flow name"}

    file_path = FLOWS_DIR / f"{safe_name}.json"

    # Add/update timestamps
    now = datetime.now().isoformat()
    if not file_path.exists():
        flow["createdAt"] = now
    flow["updatedAt"] = now

    try:
        with open(file_path, "w") as f:
            json.dump(flow, f, indent=2)
        return {"status": "saved", "name": safe_name, "path": str(file_path)}
    except Exception as e:
        return {"error": str(e)}


@app.delete("/api/flows/{name}")
async def delete_flow(name: str):
    """Delete a flow."""
    ensure_flows_dir()
    file_path = FLOWS_DIR / f"{name}.json"
    if not file_path.exists():
        return {"error": "Flow not found"}
    try:
        file_path.unlink()
        return {"status": "deleted", "name": name}
    except Exception as e:
        return {"error": str(e)}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket for dashboard clients."""
    await websocket.accept()
    dashboard_clients.append(websocket)

    # Send initial state
    await websocket.send_text(json.dumps({
        "type": "initial",
        "agents": get_agents_summary(),
        "activity": activity_log[:20],
    }))

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)

            if message.get("type") == "send_prompt":
                instance_id = message.get("instance_id")
                prompt = message.get("prompt")

                if instance_id and prompt and instance_id in agent_connections:
                    conn = agent_connections[instance_id]
                    result = await conn.send_prompt(prompt)
                    await websocket.send_text(json.dumps({
                        "type": "prompt_result",
                        "instance_id": instance_id,
                        "result": result,
                    }))

            elif message.get("type") == "send_to_role":
                role = message.get("role")
                prompt = message.get("prompt")

                for instance_id, conn in agent_connections.items():
                    if conn.entry.get("role") == role and agents.get(instance_id, {}).get("connected"):
                        result = await conn.send_prompt(prompt)
                        await websocket.send_text(json.dumps({
                            "type": "prompt_result",
                            "instance_id": instance_id,
                            "role": role,
                            "result": result,
                        }))
                        break

            elif message.get("type") == "spawn_agent":
                # Spawn a new agent via an existing connected agent
                print(f"[SPAWN] Received spawn request: {message}", flush=True)
                project_path = message.get("project_path")
                role = message.get("role")
                capabilities = message.get("capabilities", [])

                if not project_path:
                    await websocket.send_text(json.dumps({
                        "type": "spawn_result",
                        "error": "project_path is required",
                    }))
                    continue

                # Find a connected agent to spawn from
                spawn_conn = None
                for conn in agent_connections.values():
                    if agents.get(conn.instance_id, {}).get("connected"):
                        spawn_conn = conn
                        break

                if not spawn_conn:
                    # No connected agent, try to open IDE directly
                    result = await spawn_ide_directly(project_path, role, capabilities)
                    await websocket.send_text(json.dumps({
                        "type": "spawn_result",
                        **result,
                    }))
                else:
                    # Spawn via existing agent
                    result = await spawn_via_agent(spawn_conn, project_path, role, capabilities)
                    await websocket.send_text(json.dumps({
                        "type": "spawn_result",
                        **result,
                    }))

    except WebSocketDisconnect:
        if websocket in dashboard_clients:
            dashboard_clients.remove(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
