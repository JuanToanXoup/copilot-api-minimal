"""Heartbeat monitoring service."""

import asyncio
from datetime import datetime
from typing import TYPE_CHECKING

from config import HEARTBEAT_INTERVAL, STALE_THRESHOLD

if TYPE_CHECKING:
    from services.agent_manager import AgentManager
    from services.broadcast import BroadcastService


class HeartbeatService:
    """Periodically pings connected agents to check health."""

    def __init__(self, agent_manager: "AgentManager", broadcast: "BroadcastService"):
        self.agent_manager = agent_manager
        self.broadcast = broadcast

    async def start(self) -> None:
        """Start the heartbeat monitoring loop."""
        while True:
            await asyncio.sleep(HEARTBEAT_INTERVAL)
            await self._check_all_agents()

    async def _check_all_agents(self) -> None:
        """Check health of all connected agents."""
        for instance_id, conn in list(self.agent_manager.connections.items()):
            agent_state = self.agent_manager.agents.get(instance_id, {})
            if not agent_state.get("connected"):
                continue

            success = await conn.heartbeat()

            if success:
                # Agent responded, update health if it was stale
                if agent_state.get("health") != "healthy":
                    self.agent_manager.agents[instance_id]["health"] = "healthy"
                    await self.broadcast.broadcast_agent_delta(instance_id, {"health": "healthy"})
            else:
                # Check if agent is stale
                await self._mark_stale_if_needed(instance_id, agent_state)

    async def _mark_stale_if_needed(self, instance_id: str, agent_state: dict) -> None:
        """Mark agent as stale if heartbeat threshold exceeded."""
        last_hb = agent_state.get("last_heartbeat")
        if not last_hb:
            return

        try:
            last_hb_time = datetime.fromisoformat(last_hb)
            elapsed = (datetime.now() - last_hb_time).total_seconds()

            if elapsed > STALE_THRESHOLD and agent_state.get("health") != "stale":
                self.agent_manager.agents[instance_id]["health"] = "stale"
                await self.broadcast.broadcast_agent_delta(instance_id, {"health": "stale"})
        except Exception:
            pass
