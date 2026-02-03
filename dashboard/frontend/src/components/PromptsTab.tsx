import { useState, useEffect, useRef, useMemo } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  Save,
  Download,
  Upload,
  RefreshCw,
  Search,
  Tag,
  FolderOpen,
  ChevronRight,
  Copy,
  Check,
} from 'lucide-react';
import clsx from 'clsx';
import yaml from 'js-yaml';
import { useStore } from '../store';
import type { PromptTemplate, ExtractionMode, PromptPriority } from '../types';

const API_BASE = 'http://localhost:8080';

// Predefined category suggestions
const CATEGORY_SUGGESTIONS = [
  'Classification',
  'Analysis',
  'Code Generation',
  'Code Review',
  'Testing',
  'Documentation',
  'Debugging',
  'Refactoring',
  'Custom',
];

export default function PromptsTab() {
  const {
    promptTemplates,
    setPromptTemplates,
    addPromptTemplate,
    updatePromptTemplate,
    deletePromptTemplate,
    addToast,
  } = useStore();

  const [selectedPrompt, setSelectedPrompt] = useState<PromptTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
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

  // Get unique categories from prompts
  const categories = useMemo(() => {
    const cats = new Set<string>();
    promptTemplates.forEach((p) => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats).sort();
  }, [promptTemplates]);

  // Filter prompts by search and category
  const filteredPrompts = useMemo(() => {
    return promptTemplates.filter((p) => {
      const matchesSearch =
        !searchQuery ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.template.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = !selectedCategory || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [promptTemplates, searchQuery, selectedCategory]);

  // Group prompts by category
  const groupedPrompts = useMemo(() => {
    const groups: Record<string, PromptTemplate[]> = { Uncategorized: [] };
    filteredPrompts.forEach((p) => {
      const cat = p.category || 'Uncategorized';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(p);
    });
    return groups;
  }, [filteredPrompts]);

  const handleCreate = async (template: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>) => {
    const id = addPromptTemplate(template);
    const fullTemplate = useStore.getState().getPromptTemplateById(id);
    if (fullTemplate) {
      await saveToBackend(fullTemplate);
      setSelectedPrompt(fullTemplate);
    }
    setIsCreating(false);
  };

  const handleUpdate = async (template: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (selectedPrompt) {
      updatePromptTemplate(selectedPrompt.id, template);
      const fullTemplate = useStore.getState().getPromptTemplateById(selectedPrompt.id);
      if (fullTemplate) {
        await saveToBackend(fullTemplate);
        setSelectedPrompt(fullTemplate);
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this prompt template?')) {
      deletePromptTemplate(id);
      await deleteFromBackend(id);
      if (selectedPrompt?.id === id) {
        setSelectedPrompt(null);
      }
    }
  };

  const handleDuplicate = async (template: PromptTemplate) => {
    const newTemplate = {
      name: `${template.name} (Copy)`,
      description: template.description,
      category: template.category,
      tags: template.tags ? [...template.tags] : undefined,
      priority: template.priority,
      version: template.version,
      template: template.template,
      outputExtraction: { ...template.outputExtraction },
    };
    const id = addPromptTemplate(newTemplate);
    const fullTemplate = useStore.getState().getPromptTemplateById(id);
    if (fullTemplate) {
      await saveToBackend(fullTemplate);
      setSelectedPrompt(fullTemplate);
      addToast({ type: 'success', title: 'Duplicated', message: `Created "${newTemplate.name}"` });
    }
  };

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
    ]
      .filter(Boolean)
      .join('\n');

    const content = `${frontmatter}\n\n${template.template}\n`;
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${template.name.toLowerCase().replace(/\s+/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportAll = () => {
    promptTemplates.forEach((template) => {
      handleExport(template);
    });
    addToast({ type: 'success', title: 'Exported', message: `Exported ${promptTemplates.length} prompts` });
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    let imported = 0;
    for (const file of Array.from(files)) {
      try {
        const content = await file.text();
        // Get filename without extension to use as ID
        const filenameWithoutExt = file.name.replace(/\.md$/i, '');
        const parsed = parseMarkdownPrompt(content, filenameWithoutExt);
        if (parsed) {
          const id = addPromptTemplate(parsed);
          const fullTemplate = useStore.getState().getPromptTemplateById(id);
          if (fullTemplate) {
            // Save with the original filename
            await saveToBackend({ ...fullTemplate, sourceFilename: filenameWithoutExt });
            imported++;
          }
        }
      } catch (error) {
        console.error(`Failed to import ${file.name}:`, error);
      }
    }

    if (imported > 0) {
      addToast({ type: 'success', title: 'Import successful', message: `Imported ${imported} prompt(s)` });
    } else {
      addToast({ type: 'error', title: 'Import failed', message: 'No valid prompts found' });
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const parseMarkdownPrompt = (
    content: string,
    sourceFilename?: string
  ): Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'> | null => {
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
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex h-full bg-slate-50">
      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".md"
        multiple
        onChange={handleImport}
        className="hidden"
      />

      {/* Left Sidebar - Prompt List */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-800">Prompts</h2>
            <div className="flex items-center gap-1">
              <button
                onClick={loadFromBackend}
                className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                title="Refresh"
              >
                <RefreshCw className={clsx('w-4 h-4', isLoading && 'animate-spin')} />
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                title="Import .md files"
              >
                <Upload className="w-4 h-4" />
              </button>
              <button
                onClick={handleExportAll}
                className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                title="Export all"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setIsCreating(true);
                  setSelectedPrompt(null);
                }}
                className="p-1.5 rounded bg-indigo-500 text-white hover:bg-indigo-600"
                title="New prompt"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search prompts..."
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        </div>

        {/* Category Filter */}
        <div className="px-4 py-2 border-b border-slate-200 flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setSelectedCategory(null)}
            className={clsx(
              'px-2 py-1 rounded text-xs font-medium whitespace-nowrap',
              !selectedCategory ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            )}
          >
            All ({promptTemplates.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
              className={clsx(
                'px-2 py-1 rounded text-xs font-medium whitespace-nowrap',
                selectedCategory === cat
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              {cat} ({promptTemplates.filter((p) => p.category === cat).length})
            </button>
          ))}
        </div>

        {/* Prompt List */}
        <div className="flex-1 overflow-y-auto">
          {Object.entries(groupedPrompts).map(([category, prompts]) =>
            prompts.length > 0 ? (
              <div key={category}>
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                  <FolderOpen className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{category}</span>
                  <span className="text-xs text-slate-400">({prompts.length})</span>
                </div>
                {prompts.map((prompt) => (
                  <button
                    key={prompt.id}
                    onClick={() => {
                      setSelectedPrompt(prompt);
                      setIsCreating(false);
                    }}
                    className={clsx(
                      'w-full px-4 py-3 text-left border-b border-slate-100 hover:bg-slate-50 transition-colors',
                      selectedPrompt?.id === prompt.id && 'bg-indigo-50 border-l-2 border-l-indigo-500'
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm text-slate-800 truncate">{prompt.name}</div>
                        {prompt.description && (
                          <div className="text-xs text-slate-500 truncate mt-0.5">{prompt.description}</div>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0 mt-0.5" />
                    </div>
                  </button>
                ))}
              </div>
            ) : null
          )}

          {filteredPrompts.length === 0 && (
            <div className="p-8 text-center text-slate-400">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No prompts found</p>
              <button
                onClick={() => setIsCreating(true)}
                className="mt-2 text-indigo-500 hover:text-indigo-600 text-sm"
              >
                Create one
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Editor */}
      <div className="flex-1 flex flex-col">
        {isCreating ? (
          <PromptEditor
            onSave={handleCreate}
            categories={categories}
          />
        ) : selectedPrompt ? (
          <PromptEditor
            key={selectedPrompt.id}
            template={selectedPrompt}
            onSave={handleUpdate}
            onDelete={() => handleDelete(selectedPrompt.id)}
            onDuplicate={() => handleDuplicate(selectedPrompt)}
            onExport={() => handleExport(selectedPrompt)}
            onCopy={(text) => copyToClipboard(text, selectedPrompt.id)}
            copied={copiedId === selectedPrompt.id}
            categories={categories}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            <div className="text-center">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Select a prompt to edit</p>
              <p className="text-sm mt-1">Or create a new one</p>
              <button
                onClick={() => setIsCreating(true)}
                className="mt-4 px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 text-sm font-medium"
              >
                <Plus className="w-4 h-4 inline mr-2" />
                New Prompt
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Prompt Editor Component
interface PromptEditorProps {
  template?: PromptTemplate;
  onSave: (template: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onExport?: () => void;
  onCopy?: (text: string) => void;
  copied?: boolean;
  categories: string[];
}

function PromptEditor({
  template,
  onSave,
  onDelete,
  onDuplicate,
  onExport,
  onCopy,
  copied,
  categories,
}: PromptEditorProps) {
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [category, setCategory] = useState(template?.category || '');
  const [tags, setTags] = useState<string[]>(template?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [priority, setPriority] = useState<PromptPriority | ''>(template?.priority || '');
  const [version, setVersion] = useState(template?.version || '');
  const [promptTemplate, setPromptTemplate] = useState(template?.template || '');
  const [extractionMode, setExtractionMode] = useState<ExtractionMode>(template?.outputExtraction.mode || 'full');
  const [extractionPattern, setExtractionPattern] = useState(template?.outputExtraction.pattern || '');
  const [outputName, setOutputName] = useState(template?.outputExtraction.outputName || 'output');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSave = () => {
    if (!name.trim() || !promptTemplate.trim()) return;
    onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      category: category.trim() || undefined,
      tags: tags.length > 0 ? tags : undefined,
      priority: priority || undefined,
      version: version.trim() || undefined,
      template: promptTemplate,
      outputExtraction: {
        mode: extractionMode,
        pattern: extractionPattern || undefined,
        outputName: outputName || 'output',
      },
    });
  };

  // Extract variables from template
  const variables = useMemo(() => {
    const matches = promptTemplate.match(/\{\{(\w+)\}\}/g) || [];
    return [...new Set(matches.map((m) => m.slice(2, -2)))];
  }, [promptTemplate]);

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-indigo-500" />
          <h2 className="font-semibold text-slate-800">{template ? 'Edit Prompt' : 'New Prompt'}</h2>
        </div>
        <div className="flex items-center gap-2">
          {template && (
            <>
              {onCopy && (
                <button
                  onClick={() => onCopy(promptTemplate)}
                  className="p-2 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                  title="Copy template"
                >
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
              )}
              {onExport && (
                <button
                  onClick={onExport}
                  className="p-2 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                  title="Export as .md"
                >
                  <Download className="w-4 h-4" />
                </button>
              )}
              {onDuplicate && (
                <button
                  onClick={onDuplicate}
                  className="p-2 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                  title="Duplicate"
                >
                  <Copy className="w-4 h-4" />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={onDelete}
                  className="p-2 rounded hover:bg-red-50 text-slate-400 hover:text-red-600"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </>
          )}
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
            Save
          </button>
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Basic Info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Classify Test Failure"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <div className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
            <div className="relative">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                onFocus={() => setShowCategoryDropdown(true)}
                onBlur={() => setTimeout(() => setShowCategoryDropdown(false), 200)}
                placeholder="e.g., Classification"
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              {showCategoryDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {[...new Set([...categories, ...CATEGORY_SUGGESTIONS])].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => {
                        setCategory(cat);
                        setShowCategoryDropdown(false);
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 text-slate-700"
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of what this prompt does"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        {/* Tags, Priority, Version */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tags</label>
            <div className="flex flex-wrap gap-1 mb-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-indigo-900"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-1">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                placeholder="Add tag..."
                className="flex-1 px-2 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 rounded text-sm text-slate-600"
              >
                +
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as PromptPriority | '')}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="">None</option>
              <option value="P1">P1 - Critical</option>
              <option value="P2">P2 - Important</option>
              <option value="P3">P3 - Nice to have</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Version</label>
            <input
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="e.g., 1.0.0"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        </div>

        {/* Template */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-slate-700">Prompt Template</label>
            {variables.length > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-500">Variables:</span>
                {variables.map((v) => (
                  <span key={v} className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-mono">
                    {`{{${v}}}`}
                  </span>
                ))}
              </div>
            )}
          </div>
          <p className="text-xs text-slate-500 mb-2">Use {'{{variable}}'} syntax for dynamic values</p>
          <textarea
            value={promptTemplate}
            onChange={(e) => setPromptTemplate(e.target.value)}
            placeholder="Enter your prompt template..."
            rows={12}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
          />
        </div>

        {/* Output Extraction */}
        <div className="bg-slate-50 rounded-lg p-4 space-y-4">
          <h4 className="text-sm font-medium text-slate-700">Output Extraction</h4>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Output Name</label>
              <input
                type="text"
                value={outputName}
                onChange={(e) => setOutputName(e.target.value)}
                placeholder="output"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Extraction Mode</label>
              <select
                value={extractionMode}
                onChange={(e) => setExtractionMode(e.target.value as ExtractionMode)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
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
              <label className="block text-xs font-medium text-slate-600 mb-1">Pattern</label>
              <input
                type="text"
                value={extractionPattern}
                onChange={(e) => setExtractionPattern(e.target.value)}
                placeholder={extractionMode === 'jsonpath' ? '$.result.value' : '(\\d+)'}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          )}
        </div>

        {/* Metadata */}
        {template && (
          <div className="text-xs text-slate-400 space-y-1">
            <p>ID: {template.id}</p>
            {template.version && <p>Version: {template.version}</p>}
            {template.priority && <p>Priority: {template.priority}</p>}
            {template.tags && template.tags.length > 0 && <p>Tags: {template.tags.join(', ')}</p>}
            <p>Created: {new Date(template.createdAt).toLocaleString()}</p>
            <p>Updated: {new Date(template.updatedAt).toLocaleString()}</p>
          </div>
        )}
      </div>
    </div>
  );
}
