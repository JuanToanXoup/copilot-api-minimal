/**
 * Output validation utilities for agent responses
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  suggestions: string[];
}

export interface OutputSchema {
  // For JSON output
  type?: string;
  properties?: Record<string, unknown>;
  required?: string[];

  // For code output
  language?: string;
  hasTests?: boolean;
  hasComments?: boolean;
  maxLines?: number;

  // For text output
  minLength?: number;
  maxLength?: number;
  pattern?: string;

  // For markdown
  hasHeaders?: boolean;
  hasCodeBlocks?: boolean;
}

/**
 * Validate an agent's output against the expected type and schema
 */
export function validateOutput(
  output: string,
  outputType: string,
  schemaStr?: string
): ValidationResult {
  if (!output || output.trim().length === 0) {
    return {
      valid: false,
      errors: ['Output is empty'],
      suggestions: ['Please provide a non-empty response'],
    };
  }

  let schema: OutputSchema = {};
  if (schemaStr) {
    try {
      schema = JSON.parse(schemaStr);
    } catch {
      // Invalid schema JSON, skip schema validation
    }
  }

  switch (outputType) {
    case 'json':
      return validateJsonOutput(output, schema);
    case 'code':
      return validateCodeOutput(output, schema);
    case 'markdown':
      return validateMarkdownOutput(output, schema);
    case 'text':
    default:
      return validateTextOutput(output, schema);
  }
}

function validateJsonOutput(output: string, schema: OutputSchema): ValidationResult {
  const errors: string[] = [];
  const suggestions: string[] = [];

  // Try to extract JSON from the output (might be wrapped in markdown code blocks)
  let jsonStr = output;
  const jsonMatch = output.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  // Try to parse as JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    errors.push('Output is not valid JSON');
    suggestions.push('Please format your response as valid JSON');
    return { valid: false, errors, suggestions };
  }

  // Validate against schema if provided
  if (schema.type === 'object' && schema.properties && typeof parsed === 'object' && parsed !== null) {
    const obj = parsed as Record<string, unknown>;

    // Check required properties
    if (schema.required) {
      for (const prop of schema.required) {
        if (!(prop in obj)) {
          errors.push(`Missing required property: ${prop}`);
          suggestions.push(`Include the "${prop}" property in your JSON response`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    suggestions,
  };
}

function validateCodeOutput(output: string, schema: OutputSchema): ValidationResult {
  const errors: string[] = [];
  const suggestions: string[] = [];

  // Check if output contains code (might be in markdown code blocks)
  const hasCodeBlock = /```[\s\S]*```/.test(output);
  const hasIndentedCode = /^(  |\t).+/m.test(output);

  if (!hasCodeBlock && !hasIndentedCode && output.length < 50) {
    errors.push('Output does not appear to contain code');
    suggestions.push('Please provide code in a code block (``` ```)');
  }

  // Check language if specified
  if (schema.language) {
    const langMatch = output.match(/```(\w+)/);
    if (langMatch && langMatch[1].toLowerCase() !== schema.language.toLowerCase()) {
      errors.push(`Expected ${schema.language} code, got ${langMatch[1]}`);
      suggestions.push(`Please provide code in ${schema.language}`);
    }
  }

  // Check for tests if required
  if (schema.hasTests) {
    const hasTestPatterns = /(?:test|spec|describe|it\(|expect\(|assert)/i.test(output);
    if (!hasTestPatterns) {
      errors.push('Code should include tests');
      suggestions.push('Please include test cases for the code');
    }
  }

  // Check for comments if required
  if (schema.hasComments) {
    const hasComments = /(?:\/\/|\/\*|#|"""|''')/m.test(output);
    if (!hasComments) {
      errors.push('Code should include comments');
      suggestions.push('Please add comments explaining the code');
    }
  }

  // Check max lines
  if (schema.maxLines) {
    const lineCount = output.split('\n').length;
    if (lineCount > schema.maxLines) {
      errors.push(`Code exceeds ${schema.maxLines} lines (has ${lineCount})`);
      suggestions.push(`Please keep the code under ${schema.maxLines} lines`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    suggestions,
  };
}

function validateMarkdownOutput(output: string, schema: OutputSchema): ValidationResult {
  const errors: string[] = [];
  const suggestions: string[] = [];

  // Check for headers if required
  if (schema.hasHeaders) {
    const hasHeaders = /^#{1,6}\s+.+/m.test(output);
    if (!hasHeaders) {
      errors.push('Markdown should include headers');
      suggestions.push('Please structure your response with headers (# Header)');
    }
  }

  // Check for code blocks if required
  if (schema.hasCodeBlocks) {
    const hasCodeBlocks = /```[\s\S]*```/.test(output);
    if (!hasCodeBlocks) {
      errors.push('Markdown should include code blocks');
      suggestions.push('Please include code examples in code blocks');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    suggestions,
  };
}

function validateTextOutput(output: string, schema: OutputSchema): ValidationResult {
  const errors: string[] = [];
  const suggestions: string[] = [];

  // Check min length
  if (schema.minLength && output.length < schema.minLength) {
    errors.push(`Output is too short (min: ${schema.minLength} chars)`);
    suggestions.push(`Please provide a more detailed response (at least ${schema.minLength} characters)`);
  }

  // Check max length
  if (schema.maxLength && output.length > schema.maxLength) {
    errors.push(`Output is too long (max: ${schema.maxLength} chars)`);
    suggestions.push(`Please keep your response under ${schema.maxLength} characters`);
  }

  // Check pattern
  if (schema.pattern) {
    try {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(output)) {
        errors.push('Output does not match expected pattern');
        suggestions.push('Please format your response according to the expected pattern');
      }
    } catch {
      // Invalid regex, skip
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    suggestions,
  };
}

/**
 * Generate a retry prompt that asks the agent to correct its output
 */
export function generateRetryPrompt(
  originalPrompt: string,
  previousOutput: string,
  outputType: string,
  schema: OutputSchema,
  validationResult: ValidationResult
): string {
  const errorList = validationResult.errors.join('\n- ');
  const suggestionList = validationResult.suggestions.join('\n- ');

  let schemaDescription = '';
  if (outputType === 'json' && schema.properties) {
    schemaDescription = `\nExpected JSON structure: ${JSON.stringify(schema, null, 2)}`;
  } else if (outputType === 'code' && schema.language) {
    schemaDescription = `\nExpected: ${schema.language} code`;
    if (schema.hasTests) schemaDescription += ' with tests';
    if (schema.hasComments) schemaDescription += ' with comments';
  }

  return `Your previous response did not meet the expected output format.

**Issues found:**
- ${errorList}

**Please fix:**
- ${suggestionList}
${schemaDescription}

**Your previous output:**
\`\`\`
${previousOutput.slice(0, 500)}${previousOutput.length > 500 ? '...' : ''}
\`\`\`

**Original request:**
${originalPrompt}

Please provide a corrected response that matches the expected ${outputType} format.`;
}
