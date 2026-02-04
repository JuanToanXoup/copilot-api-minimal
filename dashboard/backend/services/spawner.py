"""IDE spawning service."""

import os
import subprocess
import sys
from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from services.broadcast import BroadcastService


class SpawnerService:
    """Handles spawning new IDE instances."""

    def __init__(self, broadcast: "BroadcastService"):
        self.broadcast = broadcast

    async def spawn(
        self,
        project_path: str,
        capabilities: Optional[list] = None,
    ) -> dict:
        """Spawn IDE with the given project."""
        print(f"[SPAWN] spawn called with path: {project_path}", flush=True)
        sys.stdout.flush()

        if not os.path.isdir(project_path):
            print(f"[SPAWN] Path does not exist: {project_path}")
            return {"error": f"Path does not exist: {project_path}"}

        # Try AppleScript first (macOS)
        result = await self._try_applescript(project_path)
        if result:
            return result

        # Fallback to direct binary
        result = await self._try_direct_binary(project_path)
        if result:
            return result

        print("[SPAWN] All commands failed", flush=True)
        return {"error": "Failed to launch IDE"}

    async def _try_applescript(
        self,
        project_path: str,
    ) -> Optional[dict]:
        """Try launching via AppleScript (macOS)."""
        applescript = f'''
        tell application "IntelliJ IDEA CE"
            activate
            open "{project_path}"
        end tell
        '''

        try:
            print("[SPAWN] Trying AppleScript approach", flush=True)
            proc = subprocess.Popen(
                ["osascript", "-e", applescript],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            stdout, stderr = proc.communicate(timeout=10)

            if proc.returncode == 0:
                print("[SPAWN] AppleScript succeeded", flush=True)
                self._log_spawn(project_path)
                return self._success_response(project_path)
            else:
                print(f"[SPAWN] AppleScript failed: {stderr.decode()}", flush=True)
        except Exception as e:
            print(f"[SPAWN] AppleScript error: {e}", flush=True)

        return None

    async def _try_direct_binary(
        self,
        project_path: str,
    ) -> Optional[dict]:
        """Try launching via direct binary."""
        idea_binary = "/Applications/IntelliJ IDEA CE.app/Contents/MacOS/idea"
        if not os.path.exists(idea_binary):
            idea_binary = "/Applications/IntelliJ IDEA.app/Contents/MacOS/idea"

        env = os.environ.copy()

        try:
            print(f"[SPAWN] Trying command: {idea_binary}", flush=True)
            proc = subprocess.Popen(
                [idea_binary, project_path],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                env=env
            )

            try:
                proc.wait(timeout=2)
                if proc.returncode != 0:
                    stderr = proc.stderr.read().decode() if proc.stderr else ""
                    print(f"[SPAWN] Command returned {proc.returncode}: {stderr}", flush=True)
                    return None
            except subprocess.TimeoutExpired:
                # Process still running = launched successfully
                pass

            print(f"[SPAWN] Command succeeded", flush=True)
            self._log_spawn(project_path)
            return self._success_response(project_path)

        except FileNotFoundError as e:
            print(f"[SPAWN] Command not found: {e}", flush=True)
        except Exception as e:
            print(f"[SPAWN] Command failed: {e}", flush=True)

        return None

    def _log_spawn(self, project_path: str) -> None:
        """Log spawn activity."""
        self.broadcast.log_activity(
            "agent_spawning",
            0,
            "dashboard",
            project_path=project_path,
        )

    def _success_response(self, project_path: str) -> dict:
        """Create success response."""
        return {
            "status": "launched",
            "project_path": project_path,
            "message": "IDE launched. Agent will appear when ready.",
        }
