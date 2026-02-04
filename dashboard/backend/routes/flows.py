"""Flow management API routes."""

import json
from datetime import datetime
from pathlib import Path
from typing import Any

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


def _sanitize_filename(name: str) -> str:
    """Sanitize a name for use as a filename."""
    safe = "".join(c for c in name if c.isalnum() or c in "-_ ").strip()
    return safe or "unnamed"


@router.get("")
async def list_flows(
    project_path: str | None = Query(None, description="Project path for local storage")
) -> list[dict[str, Any]]:
    """List all saved flows, including those in nested subfolders."""
    flows_dir = _get_flows_dir(project_path)
    flows = []

    # Get flows from root directory
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
                    "folder": None,  # Root level
                })
        except Exception:
            continue

    # Recursively get flows from all subfolders
    def scan_folder(folder_path: Path, folder_name: str):
        """Scan a folder and its subfolders for flows."""
        for file in folder_path.glob("*.json"):
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
                        "folder": folder_name,
                    })
            except Exception:
                continue

        # Recursively scan subfolders
        for subfolder in folder_path.iterdir():
            if subfolder.is_dir() and not subfolder.name.startswith('.'):
                nested_name = f"{folder_name}/{subfolder.name}"
                scan_folder(subfolder, nested_name)

    # Start scanning from top-level folders
    for folder in flows_dir.iterdir():
        if folder.is_dir() and not folder.name.startswith('.'):
            scan_folder(folder, folder.name)

    return sorted(flows, key=lambda x: x.get("updatedAt", "") or "", reverse=True)


@router.get("/{name:path}")
async def get_flow(
    name: str,
    project_path: str | None = Query(None, description="Project path for local storage")
):
    """Get a specific flow by name (can include folder path)."""
    flows_dir = _get_flows_dir(project_path)

    # Handle folder paths in name
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
    safe_name = _sanitize_filename(name)
    if not safe_name:
        return {"error": "Invalid flow name"}

    # Determine target folder
    folder = flow.pop("folder", None)
    if folder:
        target_dir = flows_dir / folder
        target_dir.mkdir(parents=True, exist_ok=True)
    else:
        target_dir = flows_dir

    file_path = target_dir / f"{safe_name}.json"

    # Add/update timestamps
    now = datetime.now().isoformat()
    if not file_path.exists():
        flow["createdAt"] = now
    flow["updatedAt"] = now

    try:
        with open(file_path, "w") as f:
            json.dump(flow, f, indent=2)
        return {"status": "saved", "name": safe_name, "path": str(file_path), "folder": folder}
    except Exception as e:
        return {"error": str(e)}


@router.delete("/{name:path}")
async def delete_flow(
    name: str,
    project_path: str | None = Query(None, description="Project path for local storage")
):
    """Delete a flow (name can include folder path)."""
    flows_dir = _get_flows_dir(project_path)
    file_path = flows_dir / f"{name}.json"

    if not file_path.exists():
        return {"error": "Flow not found"}

    try:
        file_path.unlink()
        return {"status": "deleted", "name": name}
    except Exception as e:
        return {"error": str(e)}


# ============== Folder Management ==============

@router.get("/folders/list")
async def list_folders(
    project_path: str | None = Query(None, description="Project path for local storage")
) -> list[dict[str, Any]]:
    """List all workflow folders, including nested ones."""
    flows_dir = _get_flows_dir(project_path)
    folders = []

    def scan_folders(base_path: Path, prefix: str = ""):
        """Recursively scan for folders."""
        for item in base_path.iterdir():
            if item.is_dir() and not item.name.startswith('.'):
                # Count flows in folder (only direct .json files, not nested)
                flow_count = len(list(item.glob("*.json")))
                folder_name = f"{prefix}{item.name}" if prefix else item.name
                folders.append({
                    "name": folder_name,
                    "path": str(item),
                    "flowCount": flow_count,
                    "parent": prefix.rstrip('/') if prefix else None,
                })
                # Recursively scan subfolders
                scan_folders(item, f"{folder_name}/")

    scan_folders(flows_dir)
    return sorted(folders, key=lambda x: x['name'].lower())


@router.post("/folders")
async def create_folder(
    data: dict[str, Any],
    project_path: str | None = Query(None, description="Project path for local storage")
) -> dict[str, Any]:
    """Create a new workflow folder, optionally inside a parent folder."""
    flows_dir = _get_flows_dir(project_path)

    name = data.get("name", "").strip()
    if not name:
        return {"error": "Folder name is required"}

    # Sanitize folder name
    safe_name = _sanitize_filename(name)
    if not safe_name:
        return {"error": "Invalid folder name"}

    # Handle parent folder
    parent = data.get("parent")
    if parent:
        base_dir = flows_dir / parent
        folder_path = base_dir / safe_name
        full_name = f"{parent}/{safe_name}"
    else:
        folder_path = flows_dir / safe_name
        full_name = safe_name

    if folder_path.exists():
        return {"error": "Folder already exists"}

    try:
        folder_path.mkdir(parents=True, exist_ok=True)
        return {"status": "created", "name": full_name, "path": str(folder_path)}
    except Exception as e:
        return {"error": str(e)}


@router.put("/folders/{folder_name:path}")
async def rename_folder(
    folder_name: str,
    data: dict[str, Any],
    project_path: str | None = Query(None, description="Project path for local storage")
) -> dict[str, Any]:
    """Rename a workflow folder."""
    flows_dir = _get_flows_dir(project_path)

    new_name = data.get("name", "").strip()
    if not new_name:
        return {"error": "New folder name is required"}

    safe_new_name = _sanitize_filename(new_name)
    if not safe_new_name:
        return {"error": "Invalid folder name"}

    old_path = flows_dir / folder_name
    if not old_path.exists():
        return {"error": "Folder not found"}

    # Determine parent directory and new path
    parent_dir = old_path.parent
    new_path = parent_dir / safe_new_name

    if new_path.exists():
        return {"error": "A folder with that name already exists"}

    try:
        old_path.rename(new_path)
        # Calculate new full name
        if parent_dir == flows_dir:
            new_full_name = safe_new_name
        else:
            parent_name = str(parent_dir.relative_to(flows_dir))
            new_full_name = f"{parent_name}/{safe_new_name}"
        return {"status": "renamed", "oldName": folder_name, "newName": new_full_name}
    except Exception as e:
        return {"error": str(e)}


@router.delete("/folders/{folder_name:path}")
async def delete_folder(
    folder_name: str,
    force: bool = False,
    project_path: str | None = Query(None, description="Project path for local storage")
) -> dict[str, Any]:
    """Delete a workflow folder."""
    flows_dir = _get_flows_dir(project_path)
    folder_path = flows_dir / folder_name

    if not folder_path.exists():
        return {"error": "Folder not found"}

    # Check if folder has contents
    flow_count = len(list(folder_path.glob("*.json")))
    subfolder_count = len([d for d in folder_path.iterdir() if d.is_dir()])

    if (flow_count > 0 or subfolder_count > 0) and not force:
        return {
            "error": "Folder is not empty",
            "flowCount": flow_count,
            "subfolderCount": subfolder_count,
        }

    try:
        # Delete recursively if force=True
        import shutil
        shutil.rmtree(folder_path)
        return {"status": "deleted", "name": folder_name}
    except Exception as e:
        return {"error": str(e)}


@router.post("/move")
async def move_flow(
    data: dict[str, Any],
    project_path: str | None = Query(None, description="Project path for local storage")
) -> dict[str, Any]:
    """Move a workflow to a different folder."""
    flows_dir = _get_flows_dir(project_path)

    flow_name = data.get("flowName")
    source_folder = data.get("sourceFolder")
    target_folder = data.get("targetFolder")

    if not flow_name:
        return {"error": "Flow name is required"}

    # Determine source path
    if source_folder:
        source_path = flows_dir / source_folder / f"{flow_name}.json"
    else:
        source_path = flows_dir / f"{flow_name}.json"

    if not source_path.exists():
        return {"error": "Flow not found"}

    # Determine target path
    if target_folder:
        target_dir = flows_dir / target_folder
        target_dir.mkdir(parents=True, exist_ok=True)
        target_path = target_dir / f"{flow_name}.json"
    else:
        target_path = flows_dir / f"{flow_name}.json"

    if target_path.exists() and source_path != target_path:
        return {"error": "A flow with that name already exists in the target folder"}

    try:
        source_path.rename(target_path)
        return {"status": "moved", "name": flow_name, "folder": target_folder}
    except Exception as e:
        return {"error": str(e)}
