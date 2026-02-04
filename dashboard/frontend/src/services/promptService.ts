import type { PromptTemplate } from '../types';

const API_BASE = 'http://localhost:8080';

function buildApiUrl(path: string, projectPath: string | null): string {
  const url = `${API_BASE}${path}`;
  if (projectPath) {
    return `${url}${url.includes('?') ? '&' : '?'}project_path=${encodeURIComponent(projectPath)}`;
  }
  return url;
}

export interface FolderInfo {
  name: string;
  promptCount: number;
  parent: string | null;
}

export async function loadPrompts(projectPath: string | null = null): Promise<PromptTemplate[]> {
  const response = await fetch(buildApiUrl('/api/prompts', projectPath));
  if (response.ok) {
    return await response.json();
  }
  throw new Error('Failed to load prompts');
}

export async function loadFolders(projectPath: string | null = null): Promise<FolderInfo[]> {
  const response = await fetch(buildApiUrl('/api/prompts/folders/list', projectPath));
  if (response.ok) {
    return await response.json();
  }
  throw new Error('Failed to load folders');
}

export async function savePrompt(
  template: PromptTemplate & { folder?: string | null; sourceFilename?: string },
  projectPath: string | null = null
): Promise<{ error?: string; path?: string }> {
  const response = await fetch(buildApiUrl('/api/prompts', projectPath), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(template),
  });
  return await response.json();
}

export async function deletePrompt(
  id: string,
  projectPath: string | null = null
): Promise<{ error?: string }> {
  const response = await fetch(buildApiUrl(`/api/prompts/${encodeURIComponent(id)}`, projectPath), {
    method: 'DELETE',
  });
  return await response.json();
}

export async function createFolder(
  name: string,
  parent?: string | null,
  projectPath: string | null = null
): Promise<{ error?: string; name?: string }> {
  const response = await fetch(buildApiUrl('/api/prompts/folders', projectPath), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, parent }),
  });
  return await response.json();
}

export async function renameFolder(
  oldName: string,
  newName: string,
  projectPath: string | null = null
): Promise<{ error?: string; newName?: string }> {
  const response = await fetch(buildApiUrl(`/api/prompts/folders/${encodeURIComponent(oldName)}`, projectPath), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: newName }),
  });
  return await response.json();
}

export async function deleteFolder(
  name: string,
  force: boolean = false,
  projectPath: string | null = null
): Promise<{ error?: string; promptCount?: number }> {
  const baseUrl = buildApiUrl(`/api/prompts/folders/${encodeURIComponent(name)}`, projectPath);
  const response = await fetch(
    `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}force=${force}`,
    { method: 'DELETE' }
  );
  return await response.json();
}

export async function movePromptToFolder(
  promptId: string,
  sourceFolder: string | null,
  targetFolder: string | null,
  projectPath: string | null = null
): Promise<{ error?: string }> {
  const response = await fetch(buildApiUrl('/api/prompts/move', projectPath), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ promptId, sourceFolder, targetFolder }),
  });
  return await response.json();
}

export async function initProject(projectPath: string): Promise<{
  status?: string;
  error?: string;
  path?: string;
  workflows_dir?: string;
  prompts_dir?: string;
}> {
  const response = await fetch(`${API_BASE}/api/project/init?project_path=${encodeURIComponent(projectPath)}`, {
    method: 'POST',
  });
  return await response.json();
}

export async function getProjectInfo(projectPath: string): Promise<{
  project_path: string;
  project_name: string;
  has_local_citi_agent: boolean;
  is_using_local: boolean;
  workflows_count: number;
  prompts_count: number;
  error?: string;
}> {
  const response = await fetch(`${API_BASE}/api/project/info?project_path=${encodeURIComponent(projectPath)}`);
  return await response.json();
}
