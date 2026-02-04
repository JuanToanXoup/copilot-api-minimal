import type { PromptTemplate } from '../types';

const API_BASE = 'http://localhost:8080';

export interface FolderInfo {
  name: string;
  promptCount: number;
  parent: string | null;
}

export async function loadPrompts(): Promise<PromptTemplate[]> {
  const response = await fetch(`${API_BASE}/api/prompts`);
  if (response.ok) {
    return await response.json();
  }
  throw new Error('Failed to load prompts');
}

export async function loadFolders(): Promise<FolderInfo[]> {
  const response = await fetch(`${API_BASE}/api/prompts/folders/list`);
  if (response.ok) {
    return await response.json();
  }
  throw new Error('Failed to load folders');
}

export async function savePrompt(
  template: PromptTemplate & { folder?: string | null; sourceFilename?: string }
): Promise<{ error?: string; path?: string }> {
  const response = await fetch(`${API_BASE}/api/prompts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(template),
  });
  return await response.json();
}

export async function deletePrompt(id: string): Promise<{ error?: string }> {
  const response = await fetch(`${API_BASE}/api/prompts/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  return await response.json();
}

export async function createFolder(
  name: string,
  parent?: string | null
): Promise<{ error?: string; name?: string }> {
  const response = await fetch(`${API_BASE}/api/prompts/folders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, parent }),
  });
  return await response.json();
}

export async function renameFolder(
  oldName: string,
  newName: string
): Promise<{ error?: string; newName?: string }> {
  const response = await fetch(`${API_BASE}/api/prompts/folders/${encodeURIComponent(oldName)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: newName }),
  });
  return await response.json();
}

export async function deleteFolder(
  name: string,
  force: boolean = false
): Promise<{ error?: string; promptCount?: number }> {
  const response = await fetch(
    `${API_BASE}/api/prompts/folders/${encodeURIComponent(name)}?force=${force}`,
    { method: 'DELETE' }
  );
  return await response.json();
}

export async function movePromptToFolder(
  promptId: string,
  sourceFolder: string | null,
  targetFolder: string | null
): Promise<{ error?: string }> {
  const response = await fetch(`${API_BASE}/api/prompts/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ promptId, sourceFolder, targetFolder }),
  });
  return await response.json();
}
