"""Flow management API routes."""

import json
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Query

from config import get_project_paths
from models import FlowSummary

router = APIRouter(prefix="/api/flows", tags=["flows"])


def _get_flows_dir(project_path: str | None) -> Path:
    """Get flows directory, creating if needed."""
    paths = get_project_paths(project_path)
    flows_dir = paths["flows_dir"]
    flows_dir.mkdir(parents=True, exist_ok=True)
    return flows_dir


@router.get("")
async def list_flows(
    project_path: str | None = Query(None, description="Project path for local storage")
) -> list[FlowSummary]:
    """List all saved flows."""
    flows_dir = _get_flows_dir(project_path)
    flows = []

    for file in flows_dir.glob("*.json"):
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


@router.get("/{name}")
async def get_flow(
    name: str,
    project_path: str | None = Query(None, description="Project path for local storage")
):
    """Get a specific flow by name."""
    flows_dir = _get_flows_dir(project_path)
    file_path = flows_dir / f"{name}.json"

    if not file_path.exists():
        return {"error": "Flow not found"}

    try:
        with open(file_path) as f:
            return json.load(f)
    except Exception as e:
        return {"error": str(e)}


@router.post("")
async def save_flow(
    flow: dict,
    project_path: str | None = Query(None, description="Project path for local storage")
):
    """Save a flow."""
    flows_dir = _get_flows_dir(project_path)

    name = flow.get("name")
    if not name:
        return {"error": "Flow name is required"}

    # Sanitize filename
    safe_name = "".join(c for c in name if c.isalnum() or c in "-_ ").strip()
    if not safe_name:
        return {"error": "Invalid flow name"}

    file_path = flows_dir / f"{safe_name}.json"

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


@router.delete("/{name}")
async def delete_flow(
    name: str,
    project_path: str | None = Query(None, description="Project path for local storage")
):
    """Delete a flow."""
    flows_dir = _get_flows_dir(project_path)
    file_path = flows_dir / f"{name}.json"

    if not file_path.exists():
        return {"error": "Flow not found"}

    try:
        file_path.unlink()
        return {"status": "deleted", "name": name}
    except Exception as e:
        return {"error": str(e)}
