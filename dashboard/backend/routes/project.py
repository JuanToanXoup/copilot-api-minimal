"""Project management API routes.

Handles project-local .citi-agent folder initialization and info.
"""

from pathlib import Path

from fastapi import APIRouter, Query

from config import get_project_paths, init_project_citi_agent

router = APIRouter(prefix="/api/project", tags=["project"])


@router.post("/init")
async def initialize_project(project_path: str = Query(..., description="Path to project directory")):
    """Initialize .citi-agent folder structure in a project.

    Creates:
        project/.citi-agent/
        project/.citi-agent/workflows/
        project/.citi-agent/prompts/
        project/.citi-agent/config.json
    """
    return init_project_citi_agent(project_path)


@router.get("/info")
async def get_project_info(project_path: str = Query(..., description="Path to project directory")):
    """Check if a project has a local .citi-agent setup.

    Returns info about whether project-local storage exists.
    """
    if not project_path:
        return {"error": "project_path is required"}

    project = Path(project_path)
    if not project.exists():
        return {"error": f"Project path does not exist: {project_path}"}

    paths = get_project_paths(project_path)

    citi_agent_dir = project / ".citi-agent"
    has_local = citi_agent_dir.exists()

    # Count workflows and prompts if local exists
    workflows_count = 0
    prompts_count = 0

    if has_local:
        workflows_dir = citi_agent_dir / "workflows"
        prompts_dir = citi_agent_dir / "prompts"

        if workflows_dir.exists():
            workflows_count = len(list(workflows_dir.glob("*.json")))

        if prompts_dir.exists():
            prompts_count = len(list(prompts_dir.glob("*.md")))

    return {
        "project_path": project_path,
        "project_name": project.name,
        "has_local_citi_agent": has_local,
        "is_using_local": paths["is_local"],
        "workflows_count": workflows_count,
        "prompts_count": prompts_count,
        "paths": {
            "flows_dir": str(paths["flows_dir"]),
            "prompts_dir": str(paths["prompts_dir"]),
            "config_path": str(paths["config_path"]),
        },
    }
