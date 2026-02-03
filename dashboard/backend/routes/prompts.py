"""Prompt template management API routes.

Stores prompt templates as markdown files with YAML frontmatter.
"""

import re
from datetime import datetime
from typing import Any

import yaml
from fastapi import APIRouter

from config import PROMPTS_DIR

router = APIRouter(prefix="/api/prompts", tags=["prompts"])


def _ensure_prompts_dir() -> None:
    """Ensure prompts directory exists."""
    PROMPTS_DIR.mkdir(parents=True, exist_ok=True)


def _sanitize_filename(name: str) -> str:
    """Sanitize a name for use as a filename."""
    safe = re.sub(r'[^\w\s-]', '', name).strip()
    safe = re.sub(r'[-\s]+', '-', safe).lower()
    return safe or 'unnamed'


def _parse_markdown_prompt(content: str) -> dict[str, Any] | None:
    """Parse a markdown file with YAML frontmatter.

    Expected format:
    ---
    id: my-prompt
    name: My Prompt
    description: Optional description
    outputExtraction:
      mode: full
      outputName: output
    ---

    Prompt template content here...
    """
    # Match YAML frontmatter between --- markers
    match = re.match(r'^---\s*\n(.*?)\n---\s*\n(.*)$', content, re.DOTALL)
    if not match:
        return None

    try:
        frontmatter = yaml.safe_load(match.group(1))
        template = match.group(2).strip()

        if not frontmatter or not isinstance(frontmatter, dict):
            return None

        return {
            'id': frontmatter.get('id', ''),
            'name': frontmatter.get('name', ''),
            'description': frontmatter.get('description'),
            'category': frontmatter.get('category'),
            'tags': frontmatter.get('tags'),
            'priority': frontmatter.get('priority'),
            'version': frontmatter.get('version'),
            'template': template,
            'outputExtraction': frontmatter.get('outputExtraction', {
                'mode': 'full',
                'outputName': 'output'
            }),
            'createdAt': frontmatter.get('createdAt'),
            'updatedAt': frontmatter.get('updatedAt'),
        }
    except yaml.YAMLError:
        return None


def _format_markdown_prompt(prompt: dict[str, Any]) -> str:
    """Format a prompt as markdown with YAML frontmatter."""
    frontmatter = {
        'id': prompt.get('id', ''),
        'name': prompt.get('name', ''),
    }

    if prompt.get('description'):
        frontmatter['description'] = prompt['description']

    if prompt.get('category'):
        frontmatter['category'] = prompt['category']

    if prompt.get('tags'):
        frontmatter['tags'] = prompt['tags']

    if prompt.get('priority'):
        frontmatter['priority'] = prompt['priority']

    if prompt.get('version'):
        frontmatter['version'] = prompt['version']

    frontmatter['outputExtraction'] = prompt.get('outputExtraction', {
        'mode': 'full',
        'outputName': 'output'
    })

    if prompt.get('createdAt'):
        frontmatter['createdAt'] = prompt['createdAt']
    if prompt.get('updatedAt'):
        frontmatter['updatedAt'] = prompt['updatedAt']

    yaml_str = yaml.dump(frontmatter, default_flow_style=False, sort_keys=False)
    template = prompt.get('template', '')

    return f"---\n{yaml_str}---\n\n{template}\n"


@router.get("")
async def list_prompts() -> list[dict[str, Any]]:
    """List all saved prompt templates, including those in nested subfolders."""
    _ensure_prompts_dir()
    prompts = []

    # Get prompts from root directory
    for file in PROMPTS_DIR.glob("*.md"):
        try:
            content = file.read_text()
            prompt = _parse_markdown_prompt(content)
            if prompt:
                # Use filename as fallback ID
                if not prompt.get('id'):
                    prompt['id'] = file.stem
                prompt['folder'] = None  # Root level
                prompt['sourceFilename'] = file.stem  # Track original filename
                prompts.append(prompt)
        except Exception:
            continue

    # Recursively get prompts from all subfolders
    def scan_folder(folder_path: Path, folder_name: str):
        """Scan a folder and its subfolders for prompts."""
        for file in folder_path.glob("*.md"):
            try:
                content = file.read_text()
                prompt = _parse_markdown_prompt(content)
                if prompt:
                    if not prompt.get('id'):
                        prompt['id'] = file.stem
                    prompt['folder'] = folder_name
                    prompt['sourceFilename'] = file.stem
                    prompts.append(prompt)
            except Exception:
                continue

        # Recursively scan subfolders
        for subfolder in folder_path.iterdir():
            if subfolder.is_dir() and not subfolder.name.startswith('.'):
                nested_name = f"{folder_name}/{subfolder.name}"
                scan_folder(subfolder, nested_name)

    # Start scanning from top-level folders
    for folder in PROMPTS_DIR.iterdir():
        if folder.is_dir() and not folder.name.startswith('.'):
            scan_folder(folder, folder.name)

    return sorted(prompts, key=lambda x: x.get('updatedAt', '') or '', reverse=True)


@router.get("/{prompt_id}")
async def get_prompt(prompt_id: str) -> dict[str, Any]:
    """Get a specific prompt by ID."""
    _ensure_prompts_dir()

    # Try exact filename match first
    file_path = PROMPTS_DIR / f"{prompt_id}.md"
    if file_path.exists():
        try:
            content = file_path.read_text()
            prompt = _parse_markdown_prompt(content)
            if prompt:
                return prompt
        except Exception as e:
            return {"error": str(e)}

    # Search by ID in frontmatter
    for file in PROMPTS_DIR.glob("*.md"):
        try:
            content = file.read_text()
            prompt = _parse_markdown_prompt(content)
            if prompt and prompt.get('id') == prompt_id:
                return prompt
        except Exception:
            continue

    return {"error": "Prompt not found"}


@router.post("")
async def save_prompt(prompt: dict[str, Any]) -> dict[str, Any]:
    """Save a prompt template as a markdown file."""
    _ensure_prompts_dir()

    name = prompt.get('name')
    if not name:
        return {"error": "Prompt name is required"}

    # Generate ID if not provided
    prompt_id = prompt.get('id') or _sanitize_filename(name)
    prompt['id'] = prompt_id

    # Determine target folder
    folder = prompt.pop('folder', None)
    if folder:
        target_dir = PROMPTS_DIR / folder
        target_dir.mkdir(parents=True, exist_ok=True)
    else:
        target_dir = PROMPTS_DIR

    # Use sourceFilename if provided (preserves original filename when editing)
    # Don't pop it - we need to keep it for the response
    source_filename = prompt.get('sourceFilename')
    if source_filename:
        # Keep original filename
        safe_name = source_filename
    else:
        safe_name = _sanitize_filename(name)

    file_path = target_dir / f"{safe_name}.md"

    # Remove sourceFilename from the data we'll save to the file
    # (it's metadata about the file, not part of the prompt content)
    prompt_to_save = {k: v for k, v in prompt.items() if k != 'sourceFilename'}

    # Add/update timestamps
    now = datetime.now().isoformat()
    if not file_path.exists():
        prompt_to_save['createdAt'] = now
    else:
        # Preserve original createdAt
        existing = _parse_markdown_prompt(file_path.read_text())
        if existing and existing.get('createdAt'):
            prompt_to_save['createdAt'] = existing['createdAt']
        else:
            prompt_to_save['createdAt'] = now
    prompt_to_save['updatedAt'] = now

    try:
        content = _format_markdown_prompt(prompt_to_save)
        file_path.write_text(content)
        return {"status": "saved", "id": prompt_id, "path": str(file_path), "folder": folder, "sourceFilename": safe_name}
    except Exception as e:
        return {"error": str(e)}


@router.delete("/{prompt_id}")
async def delete_prompt(prompt_id: str, folder: str | None = None) -> dict[str, Any]:
    """Delete a prompt template."""
    _ensure_prompts_dir()

    # Determine the base directory
    base_dir = PROMPTS_DIR / folder if folder else PROMPTS_DIR

    # Try exact filename match first
    file_path = base_dir / f"{prompt_id}.md"
    if file_path.exists():
        try:
            file_path.unlink()
            return {"status": "deleted", "id": prompt_id}
        except Exception as e:
            return {"error": str(e)}

    # Search by ID in frontmatter (in the specified folder or root)
    for file in base_dir.glob("*.md"):
        try:
            content = file.read_text()
            prompt = _parse_markdown_prompt(content)
            if prompt and prompt.get('id') == prompt_id:
                file.unlink()
                return {"status": "deleted", "id": prompt_id}
        except Exception:
            continue

    # If no folder specified, also search subfolders
    if not folder:
        for subfolder in PROMPTS_DIR.iterdir():
            if subfolder.is_dir() and not subfolder.name.startswith('.'):
                for file in subfolder.glob("*.md"):
                    try:
                        content = file.read_text()
                        prompt = _parse_markdown_prompt(content)
                        if prompt and prompt.get('id') == prompt_id:
                            file.unlink()
                            return {"status": "deleted", "id": prompt_id}
                    except Exception:
                        continue

    return {"error": "Prompt not found"}


# ============== Folder Management ==============

@router.get("/folders/list")
async def list_folders() -> list[dict[str, Any]]:
    """List all prompt folders, including nested ones."""
    _ensure_prompts_dir()
    folders = []

    def scan_folders(base_path, prefix=""):
        """Recursively scan for folders."""
        for item in base_path.iterdir():
            if item.is_dir() and not item.name.startswith('.'):
                # Count prompts in folder (only direct .md files, not nested)
                prompt_count = len(list(item.glob("*.md")))
                folder_name = f"{prefix}{item.name}" if prefix else item.name
                folders.append({
                    "name": folder_name,
                    "path": str(item),
                    "promptCount": prompt_count,
                    "parent": prefix.rstrip('/') if prefix else None,
                })
                # Recursively scan subfolders
                scan_folders(item, f"{folder_name}/")

    scan_folders(PROMPTS_DIR)
    return sorted(folders, key=lambda x: x['name'].lower())


@router.post("/folders")
async def create_folder(data: dict[str, Any]) -> dict[str, Any]:
    """Create a new prompt folder, optionally inside a parent folder."""
    _ensure_prompts_dir()

    name = data.get('name', '').strip()
    if not name:
        return {"error": "Folder name is required"}

    # Sanitize folder name
    safe_name = _sanitize_filename(name)
    if not safe_name:
        return {"error": "Invalid folder name"}

    # Check for parent folder (for nested folder creation)
    parent = data.get('parent')
    if parent and parent != '__root__':
        # Create inside parent folder
        parent_path = PROMPTS_DIR / parent
        if not parent_path.exists() or not parent_path.is_dir():
            return {"error": f"Parent folder '{parent}' not found"}
        folder_path = parent_path / safe_name
        full_name = f"{parent}/{safe_name}"
    else:
        folder_path = PROMPTS_DIR / safe_name
        full_name = safe_name

    if folder_path.exists():
        return {"error": "Folder already exists"}

    try:
        folder_path.mkdir(parents=True, exist_ok=True)
        return {"status": "created", "name": full_name, "path": str(folder_path), "parent": parent}
    except Exception as e:
        return {"error": str(e)}


@router.put("/folders/{folder_name}")
async def rename_folder(folder_name: str, data: dict[str, Any]) -> dict[str, Any]:
    """Rename a prompt folder."""
    _ensure_prompts_dir()

    new_name = data.get('name', '').strip()
    if not new_name:
        return {"error": "New folder name is required"}

    old_path = PROMPTS_DIR / folder_name
    if not old_path.exists() or not old_path.is_dir():
        return {"error": "Folder not found"}

    # Sanitize new folder name
    safe_name = _sanitize_filename(new_name)
    if not safe_name:
        return {"error": "Invalid folder name"}

    new_path = PROMPTS_DIR / safe_name
    if new_path.exists() and new_path != old_path:
        return {"error": "A folder with that name already exists"}

    try:
        old_path.rename(new_path)
        return {"status": "renamed", "oldName": folder_name, "newName": safe_name, "path": str(new_path)}
    except Exception as e:
        return {"error": str(e)}


@router.delete("/folders/{folder_name}")
async def delete_folder(folder_name: str, force: bool = False) -> dict[str, Any]:
    """Delete a prompt folder. If force=True, deletes folder with contents."""
    _ensure_prompts_dir()

    folder_path = PROMPTS_DIR / folder_name
    if not folder_path.exists() or not folder_path.is_dir():
        return {"error": "Folder not found"}

    # Check if folder has contents
    contents = list(folder_path.glob("*"))
    if contents and not force:
        return {"error": "Folder is not empty. Use force=true to delete with contents.", "promptCount": len(contents)}

    try:
        if contents:
            # Delete all contents first
            for item in contents:
                if item.is_file():
                    item.unlink()
        folder_path.rmdir()
        return {"status": "deleted", "name": folder_name}
    except Exception as e:
        return {"error": str(e)}


@router.post("/move")
async def move_prompt(data: dict[str, Any]) -> dict[str, Any]:
    """Move a prompt to a different folder."""
    _ensure_prompts_dir()

    prompt_id = data.get('promptId')
    source_folder = data.get('sourceFolder')  # None for root
    target_folder = data.get('targetFolder')  # None for root

    if not prompt_id:
        return {"error": "Prompt ID is required"}

    # Determine source directory
    source_dir = PROMPTS_DIR / source_folder if source_folder else PROMPTS_DIR

    # Find the prompt file
    source_file = None
    for file in source_dir.glob("*.md"):
        content = file.read_text()
        prompt = _parse_markdown_prompt(content)
        if prompt and (prompt.get('id') == prompt_id or file.stem == prompt_id):
            source_file = file
            break

    if not source_file:
        return {"error": "Prompt not found"}

    # Determine target directory
    if target_folder:
        target_dir = PROMPTS_DIR / target_folder
        if not target_dir.exists():
            target_dir.mkdir(parents=True, exist_ok=True)
    else:
        target_dir = PROMPTS_DIR

    target_file = target_dir / source_file.name

    # Check if target already exists
    if target_file.exists() and target_file != source_file:
        return {"error": "A prompt with that filename already exists in the target folder"}

    try:
        source_file.rename(target_file)
        return {"status": "moved", "promptId": prompt_id, "targetFolder": target_folder}
    except Exception as e:
        return {"error": str(e)}
