"""Broadcasting service for dashboard WebSocket clients."""

import asyncio
import json
from datetime import datetime
from typing import TYPE_CHECKING

from fastapi import WebSocket

from config import MAX_ACTIVITY_LOG

if TYPE_CHECKING:
    from models import ActivityEvent


class BroadcastService:
    """Manages broadcasting to dashboard clients."""

    def __init__(self):
        self.clients: list[WebSocket] = []
        self.activity_log: list[dict] = []

    async def add_client(self, websocket: WebSocket) -> None:
        """Add a dashboard client."""
        self.clients.append(websocket)

    async def remove_client(self, websocket: WebSocket) -> None:
        """Remove a dashboard client."""
        if websocket in self.clients:
            self.clients.remove(websocket)

    async def broadcast(self, message: dict) -> None:
        """Send message to all dashboard clients."""
        if not self.clients:
            return

        msg_str = json.dumps(message)
        disconnected = []

        for client in self.clients:
            try:
                await client.send_text(msg_str)
            except Exception:
                disconnected.append(client)

        for client in disconnected:
            await self.remove_client(client)

    async def broadcast_agent_delta(self, instance_id: str, changes: dict) -> None:
        """Send delta update for a single agent."""
        await self.broadcast({
            "type": "agent_delta",
            "instance_id": instance_id,
            "changes": changes,
        })

    async def broadcast_agent_removed(self, instance_id: str) -> None:
        """Notify that an agent was removed."""
        await self.broadcast({
            "type": "agent_removed",
            "instance_id": instance_id,
        })

    def log_activity(
        self,
        event_type: str,
        port: int,
        instance_id: str,
        **data
    ) -> None:
        """Log activity and broadcast to clients."""
        event: ActivityEvent = {
            "timestamp": datetime.now().isoformat(),
            "event_type": event_type,
            "port": port,
            "instance_id": instance_id,
            **data,
        }
        self.activity_log.insert(0, event)
        if len(self.activity_log) > MAX_ACTIVITY_LOG:
            self.activity_log.pop()

        asyncio.create_task(self.broadcast({"type": "activity", "event": event}))

    def get_recent_activity(self, limit: int = 20) -> list[dict]:
        """Get recent activity events."""
        return self.activity_log[:limit]
