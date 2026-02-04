import yaml from 'js-yaml';
import type { PromptTemplate, ExtractionMode, PromptPriority } from '../types';

export function parseMarkdownPrompt(
  content: string,
  sourceFilename?: string
): Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'> | null {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!match) return null;

  try {
    const frontmatter = yaml.load(match[1]) as Record<string, unknown>;
    const template = match[2].trim();

    if (!frontmatter || typeof frontmatter !== 'object') return null;

    // Extract name - use filename as fallback, then description
    const name = frontmatter.name as string || sourceFilename || frontmatter.description as string;
    if (!name) return null;

    // Extract tags - can be array or string
    let tags: string[] | undefined;
    if (Array.isArray(frontmatter.tags)) {
      tags = frontmatter.tags.map(String);
    } else if (typeof frontmatter.tags === 'string') {
      tags = frontmatter.tags.split(',').map((t) => t.trim()).filter(Boolean);
    }

    // Extract outputExtraction - can be object or undefined
    const rawExtraction = frontmatter.outputExtraction as Record<string, unknown> | undefined;
    const outputExtraction = {
      mode: (rawExtraction?.mode as ExtractionMode) || 'full',
      outputName: (rawExtraction?.outputName as string) || 'output',
      pattern: rawExtraction?.pattern as string | undefined,
    };

    return {
      name: name as string,
      description: (frontmatter.description as string) || undefined,
      category: (frontmatter.category as string) || undefined,
      tags,
      priority: (frontmatter.priority as PromptPriority) || undefined,
      version: (frontmatter.version as string) || undefined,
      template,
      outputExtraction,
    };
  } catch (e) {
    console.error('Failed to parse YAML frontmatter:', e);
    return null;
  }
}

export function exportPromptToMarkdown(template: PromptTemplate): string {
  const frontmatter = [
    '---',
    `id: ${template.id}`,
    `name: ${template.name}`,
    template.description ? `description: ${template.description}` : null,
    template.category ? `category: ${template.category}` : null,
    template.tags && template.tags.length > 0 ? `tags: [${template.tags.join(', ')}]` : null,
    template.priority ? `priority: ${template.priority}` : null,
    template.version ? `version: ${template.version}` : null,
    'outputExtraction:',
    `  mode: ${template.outputExtraction.mode}`,
    `  outputName: ${template.outputExtraction.outputName}`,
    template.outputExtraction.pattern ? `  pattern: ${template.outputExtraction.pattern}` : null,
    '---',
  ]
    .filter(Boolean)
    .join('\n');

  return `${frontmatter}\n\n${template.template}\n`;
}

export function downloadPromptAsMarkdown(template: PromptTemplate): void {
  const content = exportPromptToMarkdown(template);
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${template.name.toLowerCase().replace(/\s+/g, '-')}.md`;
  a.click();
  URL.revokeObjectURL(url);
}
