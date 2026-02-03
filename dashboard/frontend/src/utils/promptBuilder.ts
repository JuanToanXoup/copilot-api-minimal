import type { RoleDefinition } from '../store';
import { roleConfigs } from './roleConfig';

// Default role descriptions - derived from unified roleConfig
export const defaultRoleDescriptions: Record<string, string> = Object.fromEntries(
  Object.entries(roleConfigs).map(([key, config]) => [key, config.promptDescription])
);

export const outputTypeInstructions: Record<string, string> = {
  text: 'Respond with plain text.',
  code: 'Respond with code in a code block (```language).',
  json: 'Respond with valid JSON only.',
  markdown: 'Respond with formatted markdown.',
};

export interface PromptConfig {
  role: string;
  outputType: string;
  outputSchema?: string;
}

/**
 * Generate the system context portion of the prompt
 */
export function generateSystemContext(
  config: PromptConfig,
  roleDefinitions?: RoleDefinition[]
): string {
  const { role, outputType, outputSchema } = config;

  // Find role definition from store or use roleConfig fallback
  const roleDef = roleDefinitions?.find((r) => r.id === role);
  const roleConfig = roleConfigs[role] || roleConfigs.coder;
  const roleLabel = roleDef?.label || roleConfig.label;
  const roleDesc = roleDef?.description || roleConfig.promptDescription;
  const roleOutputInstr = roleDef?.outputInstruction || roleConfig.outputInstruction;

  const outputInstr = outputTypeInstructions[outputType] || outputTypeInstructions.text;

  let context = `[Role: ${roleLabel.toUpperCase()}]
${roleDesc}

[Expected Output: ${outputType.toUpperCase()}]
${outputInstr}`;

  if (roleOutputInstr) {
    context += `\n${roleOutputInstr}`;
  }

  if (outputSchema) {
    try {
      // Validate it's valid JSON
      JSON.parse(outputSchema);
      context += `

[Output Schema]
Your response must conform to this schema:
${outputSchema}`;
    } catch {
      // Invalid JSON schema, skip it
    }
  }

  return context;
}

/**
 * Generate a full prompt preview with placeholder for user input
 */
export function generatePromptPreview(
  config: PromptConfig,
  roleDefinitions?: RoleDefinition[],
  userInput?: string
): string {
  const systemContext = generateSystemContext(config, roleDefinitions);
  const input = userInput || '{user input will appear here}';

  return `${systemContext}

---
${input}`;
}

/**
 * Generate the actual prompt to send to an agent
 */
export function buildAgentPrompt(
  config: PromptConfig,
  userInput: string,
  roleDefinitions?: RoleDefinition[]
): string {
  const systemContext = generateSystemContext(config, roleDefinitions);
  return `${systemContext}

${userInput}`;
}

/**
 * Get a short description of what this agent configuration does
 */
export function getConfigSummary(config: PromptConfig): string {
  const { role, outputType, outputSchema } = config;

  let summary = `${role} agent producing ${outputType}`;
  if (outputSchema) {
    summary += ' with schema validation';
  }
  return summary;
}
