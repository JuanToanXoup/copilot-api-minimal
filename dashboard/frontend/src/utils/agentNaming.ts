import type { Agent } from '../types';

/**
 * Get the display label for an agent (port-based)
 */
export function getAgentLabel(agent: Agent | null | undefined): string {
  if (!agent) return 'Unknown';
  return `:${agent.port}`;
}

/**
 * Format project name for display with smart truncation
 * Returns both display text and full path for tooltip
 */
export function formatProjectName(
  projectPath: string | null | undefined,
  maxLength: number = 25
): { display: string; full: string; needsTooltip: boolean } {
  if (!projectPath) {
    return { display: 'Unknown project', full: '', needsTooltip: false };
  }

  const full = projectPath;

  // Extract just the project folder name
  const parts = projectPath.split('/').filter(Boolean);
  const projectName = parts[parts.length - 1] || projectPath;

  if (projectName.length <= maxLength) {
    return { display: projectName, full, needsTooltip: full !== projectName };
  }

  // Truncate with ellipsis
  const truncated = projectName.slice(0, maxLength - 3) + '...';
  return { display: truncated, full, needsTooltip: true };
}

/**
 * Generate a short identifier from port number
 * Useful for quick visual identification
 */
export function getPortLabel(port: number): string {
  return `:${port}`;
}
