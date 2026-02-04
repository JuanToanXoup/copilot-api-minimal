"""Configuration constants for the dashboard backend."""

import json
from pathlib import Path
from typing import TypedDict


class ProjectPaths(TypedDict):
    """Paths for project-local or global .citi-agent storage."""
    flows_dir: Path
    prompts_dir: Path
    config_path: Path
    is_local: bool


# Global paths (fallback)
GLOBAL_CITI_AGENT_DIR = Path.home() / ".citi-agent"
REGISTRY_PATH = GLOBAL_CITI_AGENT_DIR / "registry.json"
FLOWS_DIR = GLOBAL_CITI_AGENT_DIR / "flows"
PROMPTS_DIR = GLOBAL_CITI_AGENT_DIR / "prompts"


def get_project_paths(project_path: str | None) -> ProjectPaths:
    """Get paths for workflows/prompts, preferring project-local .citi-agent.

    Args:
        project_path: Path to project directory, or None for global fallback.

    Returns:
        ProjectPaths with flows_dir, prompts_dir, config_path, and is_local flag.
    """
    if project_path:
        local_dir = Path(project_path) / ".citi-agent"
        if local_dir.exists():
            return {
                "flows_dir": local_dir / "workflows",
                "prompts_dir": local_dir / "prompts",
                "config_path": local_dir / "config.json",
                "is_local": True,
            }

    # Global fallback
    return {
        "flows_dir": FLOWS_DIR,
        "prompts_dir": PROMPTS_DIR,
        "config_path": GLOBAL_CITI_AGENT_DIR / "config.json",
        "is_local": False,
    }


def init_project_citi_agent(project_path: str) -> dict:
    """Initialize .citi-agent folder structure in a project.

    Creates:
        project/.citi-agent/
        project/.citi-agent/workflows/
        project/.citi-agent/prompts/
        project/.citi-agent/config.json

    Args:
        project_path: Path to project directory.

    Returns:
        Dict with status and created paths.
    """
    project = Path(project_path)
    if not project.exists():
        return {"error": f"Project path does not exist: {project_path}"}

    citi_agent_dir = project / ".citi-agent"
    workflows_dir = citi_agent_dir / "workflows"
    prompts_dir = citi_agent_dir / "prompts"
    config_path = citi_agent_dir / "config.json"

    try:
        # Create directories
        citi_agent_dir.mkdir(exist_ok=True)
        workflows_dir.mkdir(exist_ok=True)
        prompts_dir.mkdir(exist_ok=True)

        # Create config.json if it doesn't exist
        if not config_path.exists():
            default_config = {
                "version": "1.0",
                "projectName": project.name,
            }
            config_path.write_text(json.dumps(default_config, indent=2))

        return {
            "status": "initialized",
            "path": str(citi_agent_dir),
            "workflows_dir": str(workflows_dir),
            "prompts_dir": str(prompts_dir),
            "config_path": str(config_path),
        }
    except Exception as e:
        return {"error": str(e)}

# Timeouts (seconds)
WS_CONNECT_TIMEOUT = 5
WS_RECV_TIMEOUT = 5
PROMPT_TIMEOUT = 120
HEARTBEAT_PING_TIMEOUT = 5

# Intervals (seconds)
HEARTBEAT_INTERVAL = 10
STALE_THRESHOLD = 30
REGISTRY_POLL_INTERVAL = 10  # Fallback when watchdog misses events

# Limits
MAX_ACTIVITY_LOG = 100
