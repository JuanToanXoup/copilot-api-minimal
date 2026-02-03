"""Registry file monitoring service."""

import asyncio
from pathlib import Path
from typing import Optional, TYPE_CHECKING

from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

from config import REGISTRY_PATH, REGISTRY_POLL_INTERVAL

if TYPE_CHECKING:
    from services.agent_manager import AgentManager
    from services.broadcast import BroadcastService


class RegistryWatcher(FileSystemEventHandler):
    """Watches registry file for changes using watchdog."""

    def __init__(self, event: asyncio.Event, loop: asyncio.AbstractEventLoop):
        self.event = event
        self.loop = loop

    def on_modified(self, event) -> None:
        if event.src_path.endswith("registry.json"):
            self.loop.call_soon_threadsafe(self.event.set)

    def on_created(self, event) -> None:
        if event.src_path.endswith("registry.json"):
            self.loop.call_soon_threadsafe(self.event.set)


class RegistryService:
    """Monitors registry for agent changes."""

    def __init__(self, agent_manager: "AgentManager", broadcast: "BroadcastService"):
        self.agent_manager = agent_manager
        self.broadcast = broadcast
        self._known_instances: set[str] = set()
        self._known_entries: dict[str, dict] = {}  # Track entry data for change detection
        self._change_event = asyncio.Event()
        self._observer: Optional[Observer] = None

    async def handle_change(self) -> None:
        """Process registry changes."""
        try:
            registry = self.agent_manager.read_registry()
            current = set(registry.keys())

            # New agents
            for instance_id in current - self._known_instances:
                entry = registry[instance_id]
                await self.agent_manager.connect_agent(instance_id, entry)
                self._known_entries[instance_id] = dict(entry)

            # Removed agents
            for instance_id in self._known_instances - current:
                await self.agent_manager.disconnect_agent(instance_id)
                await self.broadcast.broadcast_agent_removed(instance_id)
                self._known_entries.pop(instance_id, None)

            # Update existing agents' registry data
            for instance_id in current & self._known_instances:
                conn = self.agent_manager.get_connection(instance_id)
                new_entry = registry[instance_id]
                old_entry = self._known_entries.get(instance_id, {})

                if conn:
                    conn.entry = new_entry

                    # Check for changes and broadcast delta
                    changes = {}
                    if new_entry.get("role") != old_entry.get("role"):
                        changes["role"] = new_entry.get("role")
                    if new_entry.get("projectPath") != old_entry.get("projectPath"):
                        project_path = new_entry.get("projectPath", "")
                        changes["project_path"] = project_path
                        changes["project_name"] = project_path.split("/")[-1] if project_path else "Unknown"
                    if new_entry.get("capabilities") != old_entry.get("capabilities"):
                        changes["capabilities"] = new_entry.get("capabilities", [])
                    if new_entry.get("agentName") != old_entry.get("agentName"):
                        changes["agent_name"] = new_entry.get("agentName")

                    if changes:
                        await self.broadcast.broadcast_agent_delta(instance_id, changes)

                    # Try reconnecting if disconnected
                    if not self.agent_manager.agents.get(instance_id, {}).get("connected"):
                        await self.agent_manager.connect_agent(instance_id, new_entry)

                self._known_entries[instance_id] = dict(new_entry)

            self._known_instances = current

        except Exception as e:
            print(f"Registry change handler error: {e}")

    async def start(self) -> None:
        """Start monitoring the registry."""
        loop = asyncio.get_event_loop()

        # Initial scan
        await self.handle_change()

        # Setup watchdog observer
        registry_dir = REGISTRY_PATH.parent

        try:
            if registry_dir.exists():
                watcher = RegistryWatcher(self._change_event, loop)
                self._observer = Observer()
                self._observer.schedule(watcher, str(registry_dir), recursive=False)
                self._observer.start()
                print(f"Watchdog monitoring {registry_dir}")
        except Exception as e:
            print(f"Failed to start watchdog: {e}, falling back to polling")

        # Main loop
        try:
            while True:
                try:
                    await asyncio.wait_for(
                        self._change_event.wait(),
                        timeout=REGISTRY_POLL_INTERVAL
                    )
                    self._change_event.clear()
                except asyncio.TimeoutError:
                    pass  # Fallback poll

                await self.handle_change()

        finally:
            if self._observer:
                self._observer.stop()
                self._observer.join()

    def stop(self) -> None:
        """Stop monitoring."""
        if self._observer:
            self._observer.stop()
            self._observer.join()
