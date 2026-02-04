/**
 * Prompt building utilities for workflow execution.
 *
 * With roles removed, prompts are now fully defined by templates.
 * This file provides output type instructions for validation.
 */

export const outputTypeInstructions: Record<string, string> = {
  text: 'Respond with plain text.',
  code: 'Respond with code in a code block (```language).',
  json: 'Respond with valid JSON only.',
  markdown: 'Respond with formatted markdown.',
};

export interface PromptConfig {
  outputType: string;
  outputSchema?: string;
}

/**
 * Generate output instruction based on output type
 */
export function generateOutputInstruction(config: PromptConfig): string {
  const { outputType, outputSchema } = config;

  let instruction = outputTypeInstructions[outputType] || outputTypeInstructions.text;

  if (outputSchema) {
    try {
      // Validate it's valid JSON
      JSON.parse(outputSchema);
      instruction += `

Your response must conform to this schema:
${outputSchema}`;
    } catch {
      // Invalid JSON schema, skip it
    }
  }

  return instruction;
}

/**
 * Get a short description of what this configuration does
 */
export function getConfigSummary(config: PromptConfig): string {
  const { outputType, outputSchema } = config;

  let summary = `producing ${outputType}`;
  if (outputSchema) {
    summary += ' with schema validation';
  }
  return summary;
}
