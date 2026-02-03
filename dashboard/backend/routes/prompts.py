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
    """List all saved prompt templates."""
    _ensure_prompts_dir()
    prompts = []

    for file in PROMPTS_DIR.glob("*.md"):
        try:
            content = file.read_text()
            prompt = _parse_markdown_prompt(content)
            if prompt:
                # Use filename as fallback ID
                if not prompt.get('id'):
                    prompt['id'] = file.stem
                prompts.append(prompt)
        except Exception:
            continue

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

    # Use sourceFilename if provided (for imports), otherwise sanitize name
    source_filename = prompt.pop('sourceFilename', None)
    if source_filename:
        # Keep original filename for imports
        safe_name = source_filename
    else:
        safe_name = _sanitize_filename(name)
    file_path = PROMPTS_DIR / f"{safe_name}.md"

    # Add/update timestamps
    now = datetime.now().isoformat()
    if not file_path.exists():
        prompt['createdAt'] = now
    else:
        # Preserve original createdAt
        existing = _parse_markdown_prompt(file_path.read_text())
        if existing and existing.get('createdAt'):
            prompt['createdAt'] = existing['createdAt']
        else:
            prompt['createdAt'] = now
    prompt['updatedAt'] = now

    try:
        content = _format_markdown_prompt(prompt)
        file_path.write_text(content)
        return {"status": "saved", "id": prompt_id, "path": str(file_path)}
    except Exception as e:
        return {"error": str(e)}


@router.delete("/{prompt_id}")
async def delete_prompt(prompt_id: str) -> dict[str, Any]:
    """Delete a prompt template."""
    _ensure_prompts_dir()

    # Try exact filename match first
    file_path = PROMPTS_DIR / f"{prompt_id}.md"
    if file_path.exists():
        try:
            file_path.unlink()
            return {"status": "deleted", "id": prompt_id}
        except Exception as e:
            return {"error": str(e)}

    # Search by ID in frontmatter
    for file in PROMPTS_DIR.glob("*.md"):
        try:
            content = file.read_text()
            prompt = _parse_markdown_prompt(content)
            if prompt and prompt.get('id') == prompt_id:
                file.unlink()
                return {"status": "deleted", "id": prompt_id}
        except Exception:
            continue

    return {"error": "Prompt not found"}
