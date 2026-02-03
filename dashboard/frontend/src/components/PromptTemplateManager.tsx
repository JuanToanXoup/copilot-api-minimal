import { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  ChevronDown,
  ChevronRight,
  Download,
  Upload,
  RefreshCw,
} from 'lucide-react';
import clsx from 'clsx';
import yaml from 'js-yaml';
import { useStore } from '../store';
import type { PromptTemplate, ExtractionMode, PromptPriority } from '../types';

const API_BASE = 'http://localhost:8080';

interface PromptTemplateEditorProps {
  template?: PromptTemplate;
  onSave: (template: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}

function PromptTemplateEditor({ template, onSave, onCancel }: PromptTemplateEditorProps) {
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [promptTemplate, setPromptTemplate] = useState(template?.template || '');
  const [extractionMode, setExtractionMode] = useState<ExtractionMode>(
    template?.outputExtraction.mode || 'full'
  );
  const [extractionPattern, setExtractionPattern] = useState(
    template?.outputExtraction.pattern || ''
  );
  const [outputName, setOutputName] = useState(
    template?.outputExtraction.outputName || 'output'
  );

  const handleSave = () => {
    if (!name.trim() || !promptTemplate.trim()) return;
    onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      template: promptTemplate,
      outputExtraction: {
        mode: extractionMode,
        pattern: extractionPattern || undefined,
        outputName: outputName || 'output',
      },
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-[560px] max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-slate-800">
            {template ? 'Edit Template' : 'New Prompt Template'}
          </h3>
          <button onClick={onCancel} className="p-1 hover:bg-slate-100 rounded">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Classify Test Failure"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Description (optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of what this template does"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {/* Template */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Prompt Template
            </label>
            <p className="text-xs text-slate-500 mb-2">
              Use {'{{variable}}'} syntax for dynamic values
            </p>
            <textarea
              value={promptTemplate}
              onChange={(e) => setPromptTemplate(e.target.value)}
              placeholder="Enter your prompt template..."
              rows={8}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
            />
          </div>

          {/* Output Extraction */}
          <div className="bg-slate-50 rounded-lg p-3 space-y-3">
            <h4 className="text-sm font-medium text-slate-700">Output Extraction</h4>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Output Name
                </label>
                <input
                  type="text"
                  value={outputName}
                  onChange={(e) => setOutputName(e.target.value)}
                  placeholder="output"
                  className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Extraction Mode
                </label>
                <select
                  value={extractionMode}
                  onChange={(e) => setExtractionMode(e.target.value as ExtractionMode)}
                  className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  <option value="full">Full Response</option>
                  <option value="json">Parse as JSON</option>
                  <option value="jsonpath">JSON Path</option>
                  <option value="regex">Regex Extract</option>
                  <option value="first_line">First Line</option>
                </select>
              </div>
            </div>

            {(extractionMode === 'jsonpath' || extractionMode === 'regex') && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Pattern
                </label>
                <input
                  type="text"
                  value={extractionPattern}
                  onChange={(e) => setExtractionPattern(e.target.value)}
                  placeholder={extractionMode === 'jsonpath' ? '$.result.value' : '(\\d+)'}
                  className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
            )}
          </div>
        </div>

        <div className="px-4 py-3 border-t bg-slate-50 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || !promptTemplate.trim()}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
              name.trim() && promptTemplate.trim()
                ? 'bg-indigo-500 text-white hover:bg-indigo-600'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            )}
          >
            <Save className="w-4 h-4" />
            Save Template
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PromptTemplateManager() {
  const {
    promptTemplates,
    setPromptTemplates,
    addPromptTemplate,
    updatePromptTemplate,
    deletePromptTemplate,
    addToast,
  } = useStore();

  const [isExpanded, setIsExpanded] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load prompts from backend on mount
  useEffect(() => {
    loadFromBackend();
  }, []);

  const loadFromBackend = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/prompts`);
      if (response.ok) {
        const prompts = await response.json();
        if (prompts.length > 0) {
          setPromptTemplates(prompts);
        }
      }
    } catch (error) {
      console.error('Failed to load prompts from backend:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveToBackend = async (template: PromptTemplate): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/api/prompts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template),
      });
      const result = await response.json();
      if (result.error) {
        addToast({ type: 'error', title: 'Save failed', message: result.error });
        return false;
      }
      addToast({ type: 'success', title: 'Prompt saved', message: `Saved to ${result.path}` });
      return true;
    } catch (error) {
      addToast({ type: 'error', title: 'Save failed', message: String(error) });
      return false;
    }
  };

  const deleteFromBackend = async (id: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/api/prompts/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      return !result.error;
    } catch {
      return false;
    }
  };

  const handleCreate = async (template: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>) => {
    const id = addPromptTemplate(template);
    const fullTemplate = useStore.getState().getPromptTemplateById(id);
    if (fullTemplate) {
      await saveToBackend(fullTemplate);
    }
    setIsCreating(false);
  };

  const handleUpdate = async (template: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingTemplate) {
      updatePromptTemplate(editingTemplate.id, template);
      const fullTemplate = useStore.getState().getPromptTemplateById(editingTemplate.id);
      if (fullTemplate) {
        await saveToBackend(fullTemplate);
      }
      setEditingTemplate(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this prompt template?')) {
      deletePromptTemplate(id);
      await deleteFromBackend(id);
    }
  };

  // Export a single prompt as .md file
  const handleExport = (template: PromptTemplate) => {
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
    ].filter(Boolean).join('\n');

    const content = `${frontmatter}\n\n${template.template}\n`;
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${template.name.toLowerCase().replace(/\s+/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import a .md file
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      const parsed = parseMarkdownPrompt(content);
      if (parsed) {
        const id = addPromptTemplate(parsed);
        const fullTemplate = useStore.getState().getPromptTemplateById(id);
        if (fullTemplate) {
          await saveToBackend(fullTemplate);
        }
        addToast({ type: 'success', title: 'Import successful', message: `Imported "${parsed.name}"` });
      } else {
        addToast({ type: 'error', title: 'Import failed', message: 'Invalid markdown format' });
      }
    } catch (error) {
      addToast({ type: 'error', title: 'Import failed', message: String(error) });
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Parse markdown with YAML frontmatter using js-yaml
  const parseMarkdownPrompt = (content: string): Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'> | null => {
    const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
    if (!match) return null;

    try {
      const frontmatter = yaml.load(match[1]) as Record<string, unknown>;
      const template = match[2].trim();

      if (!frontmatter || typeof frontmatter !== 'object') return null;

      // Extract name - required field (fallback to description for spec-kit compatibility)
      const name = frontmatter.name as string || frontmatter.description as string;
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
  };

  return (
    <div className="border-b border-slate-200">
      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".md"
        onChange={handleImport}
        className="hidden"
      />

      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
          <FileText className="w-4 h-4 text-indigo-500" />
          <span className="font-medium text-sm text-slate-700">Prompt Templates</span>
          <span className="text-xs text-slate-400">({promptTemplates.length})</span>
          {isLoading && <RefreshCw className="w-3 h-3 text-slate-400 animate-spin" />}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              loadFromBackend();
            }}
            className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600"
            title="Refresh from server"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600"
            title="Import .md file"
          >
            <Upload className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsCreating(true);
            }}
            className="p-1 rounded bg-indigo-100 text-indigo-600 hover:bg-indigo-200"
            title="New template"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </button>

      {/* Template List */}
      {isExpanded && (
        <div className="px-4 pb-3 space-y-1">
          {promptTemplates.map((template) => (
            <div
              key={template.id}
              className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 group"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-slate-700 truncate">
                  {template.name}
                </div>
                {template.description && (
                  <div className="text-xs text-slate-400 truncate">
                    {template.description}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleExport(template)}
                  className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600"
                  title="Export as .md"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setEditingTemplate(template)}
                  className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600"
                  title="Edit"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(template.id)}
                  className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-600"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}

          {promptTemplates.length === 0 && (
            <div className="text-center py-4 text-sm text-slate-400">
              No templates yet.
              <button
                onClick={() => setIsCreating(true)}
                className="text-indigo-500 hover:text-indigo-600 ml-1"
              >
                Create one
              </button>
            </div>
          )}
        </div>
      )}

      {/* Editor Modal */}
      {(isCreating || editingTemplate) && (
        <PromptTemplateEditor
          template={editingTemplate || undefined}
          onSave={editingTemplate ? handleUpdate : handleCreate}
          onCancel={() => {
            setIsCreating(false);
            setEditingTemplate(null);
          }}
        />
      )}
    </div>
  );
}
