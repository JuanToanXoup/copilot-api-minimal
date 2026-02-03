import type { Agent } from '../types';

// Adjectives for agent names - positive, professional qualities
const adjectives = [
  'Swift', 'Keen', 'Sharp', 'Bold', 'Bright',
  'Quick', 'Agile', 'Smart', 'Clever', 'Nimble',
  'Rapid', 'Steady', 'Ready', 'Eager', 'Active',
  'Prime', 'Core', 'Main', 'Chief', 'Lead',
];

// Greek letters for sequential naming
const greekLetters = [
  'Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon',
  'Zeta', 'Eta', 'Theta', 'Iota', 'Kappa',
  'Lambda', 'Mu', 'Nu', 'Xi', 'Omicron',
  'Pi', 'Rho', 'Sigma', 'Tau', 'Upsilon',
];

/**
 * Generate a unique agent name based on role and existing names
 * Format: "Adjective-GreekLetter" (e.g., "Swift-Alpha", "Keen-Beta")
 */
export function generateAgentName(
  role: string | null,
  existingNames: string[] = []
): string {
  const normalizedRole = role?.toLowerCase() || 'coder';

  // Use role to seed the adjective selection for consistency
  const roleIndex = normalizedRole.charCodeAt(0) % adjectives.length;
  const baseAdjective = adjectives[roleIndex];

  // Find the next available greek letter
  for (const letter of greekLetters) {
    const candidateName = `${baseAdjective}-${letter}`;
    if (!existingNames.includes(candidateName)) {
      return candidateName;
    }
  }

  // Fallback: use a different adjective
  for (const adj of adjectives) {
    for (const letter of greekLetters) {
      const candidateName = `${adj}-${letter}`;
      if (!existingNames.includes(candidateName)) {
        return candidateName;
      }
    }
  }

  // Last resort: add a number
  return `${baseAdjective}-${Date.now() % 1000}`;
}

/**
 * Get the display name for an agent
 * Prefers role over "Default Agent", then agent_name if meaningful
 */
export function getDisplayName(
  agent: Agent | null | undefined,
  existingNames: string[] = []
): string {
  if (!agent) return 'Unknown';

  // Prefer role if set (capitalize first letter)
  if (agent.role) {
    return agent.role.charAt(0).toUpperCase() + agent.role.slice(1);
  }

  // Use explicit agent_name if available and not "Default Agent"
  if (agent.agent_name && agent.agent_name !== 'Default Agent') {
    return agent.agent_name;
  }

  // Generate a name based on role
  return generateAgentName(agent.role, existingNames);
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

/**
 * Create a stable hash for consistent naming across sessions
 */
export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}
