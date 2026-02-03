"""Flow management API routes."""

import json
from datetime import datetime

from fastapi import APIRouter

from config import FLOWS_DIR
from models import FlowSummary

router = APIRouter(prefix="/api/flows", tags=["flows"])


def _ensure_flows_dir() -> None:
    """Ensure flows directory exists."""
    FLOWS_DIR.mkdir(parents=True, exist_ok=True)


@router.get("")
async def list_flows() -> list[FlowSummary]:
    """List all saved flows."""
    _ensure_flows_dir()
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


@router.get("/{name}")
async def get_flow(name: str):
    """Get a specific flow by name."""
    _ensure_flows_dir()
    file_path = FLOWS_DIR / f"{name}.json"

    if not file_path.exists():
        return {"error": "Flow not found"}

    try:
        with open(file_path) as f:
            return json.load(f)
    except Exception as e:
        return {"error": str(e)}


@router.post("")
async def save_flow(flow: dict):
    """Save a flow."""
    _ensure_flows_dir()

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


@router.delete("/{name}")
async def delete_flow(name: str):
    """Delete a flow."""
    _ensure_flows_dir()
    file_path = FLOWS_DIR / f"{name}.json"

    if not file_path.exists():
        return {"error": "Flow not found"}

    try:
        file_path.unlink()
        return {"status": "deleted", "name": name}
    except Exception as e:
        return {"error": str(e)}
