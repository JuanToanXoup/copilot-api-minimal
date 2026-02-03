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
  FolderPlus,
  ChevronRight,
  ChevronDown,
  Copy,
  Check,
  Pencil,
  Folder,
  MoreVertical,
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
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Folder state
  const [folders, setFolders] = useState<{ name: string; promptCount: number }[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['__root__']));
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [folderMenuOpen, setFolderMenuOpen] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null); // For creating prompts in folder

  // Drag and drop state
  const [draggedPrompt, setDraggedPrompt] = useState<{ id: string; folder: string | null } | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);

  // Load prompts and folders from backend on mount
  useEffect(() => {
    loadFromBackend();
    loadFolders();
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

  const loadFolders = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/prompts/folders/list`);
      if (response.ok) {
        const data = await response.json();
        setFolders(data);
      }
    } catch (error) {
      console.error('Failed to load folders:', error);
    }
  };

  const createFolder = async (name: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/prompts/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const result = await response.json();
      if (result.error) {
        addToast({ type: 'error', title: 'Create failed', message: result.error });
        return false;
      }
      addToast({ type: 'success', title: 'Folder created', message: `Created "${result.name}"` });
      await loadFolders();
      setExpandedFolders((prev) => new Set([...prev, result.name]));
      return true;
    } catch (error) {
      addToast({ type: 'error', title: 'Create failed', message: String(error) });
      return false;
    }
  };

  const renameFolder = async (oldName: string, newName: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/prompts/folders/${encodeURIComponent(oldName)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      });
      const result = await response.json();
      if (result.error) {
        addToast({ type: 'error', title: 'Rename failed', message: result.error });
        return false;
      }
      addToast({ type: 'success', title: 'Folder renamed', message: `Renamed to "${result.newName}"` });
      await loadFolders();
      await loadFromBackend(); // Reload prompts to get updated folder assignments
      return true;
    } catch (error) {
      addToast({ type: 'error', title: 'Rename failed', message: String(error) });
      return false;
    }
  };

  const deleteFolder = async (name: string, force: boolean = false) => {
    try {
      const response = await fetch(
        `${API_BASE}/api/prompts/folders/${encodeURIComponent(name)}?force=${force}`,
        { method: 'DELETE' }
      );
      const result = await response.json();
      if (result.error) {
        if (result.promptCount) {
          const confirmed = confirm(
            `Folder "${name}" contains ${result.promptCount} prompt(s). Delete anyway?`
          );
          if (confirmed) {
            return deleteFolder(name, true);
          }
        } else {
          addToast({ type: 'error', title: 'Delete failed', message: result.error });
        }
        return false;
      }
      addToast({ type: 'success', title: 'Folder deleted', message: `Deleted "${name}"` });
      await loadFolders();
      await loadFromBackend();
      return true;
    } catch (error) {
      addToast({ type: 'error', title: 'Delete failed', message: String(error) });
      return false;
    }
  };

  const toggleFolder = (folderName: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderName)) {
        next.delete(folderName);
      } else {
        next.add(folderName);
      }
      return next;
    });
  };

  const movePromptToFolder = async (promptId: string, sourceFolder: string | null, targetFolder: string | null) => {
    if (sourceFolder === targetFolder) return false;
    try {
      const response = await fetch(`${API_BASE}/api/prompts/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promptId, sourceFolder, targetFolder }),
      });
      const result = await response.json();
      if (result.error) {
        addToast({ type: 'error', title: 'Move failed', message: result.error });
        return false;
      }
      addToast({
        type: 'success',
        title: 'Prompt moved',
        message: targetFolder ? `Moved to "${targetFolder}"` : 'Moved to root',
      });
      await loadFromBackend();
      await loadFolders();
      return true;
    } catch (error) {
      addToast({ type: 'error', title: 'Move failed', message: String(error) });
      return false;
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, promptId: string, folder: string | null) => {
    setDraggedPrompt({ id: promptId, folder });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedPrompt(null);
    setDragOverFolder(null);
  };

  const handleDragOver = (e: React.DragEvent, folder: string | null) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const targetFolder = folder === '__root__' ? null : folder;
    setDragOverFolder(folder);
  };

  const handleDragLeave = () => {
    setDragOverFolder(null);
  };

  const handleDrop = async (e: React.DragEvent, targetFolder: string | null) => {
    e.preventDefault();
    if (draggedPrompt) {
      const actualTarget = targetFolder === '__root__' ? null : targetFolder;
      await movePromptToFolder(draggedPrompt.id, draggedPrompt.folder, actualTarget);
    }
    setDraggedPrompt(null);
    setDragOverFolder(null);
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

  // Filter prompts by search
  const filteredPrompts = useMemo(() => {
    return promptTemplates.filter((p) => {
      const matchesSearch =
        !searchQuery ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.template.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [promptTemplates, searchQuery]);

  // Group prompts by folder
  const groupedByFolder = useMemo(() => {
    const groups: Record<string, (PromptTemplate & { folder?: string | null })[]> = { __root__: [] };
    filteredPrompts.forEach((p) => {
      const folder = (p as PromptTemplate & { folder?: string | null }).folder || '__root__';
      if (!groups[folder]) groups[folder] = [];
      groups[folder].push(p as PromptTemplate & { folder?: string | null });
    });
    return groups;
  }, [filteredPrompts]);

  const handleCreate = async (template: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'> & { folder?: string | null }) => {
    const id = addPromptTemplate(template);
    const fullTemplate = useStore.getState().getPromptTemplateById(id);
    if (fullTemplate) {
      await saveToBackend({ ...fullTemplate, folder: template.folder || selectedFolder } as PromptTemplate & { folder?: string | null });
      setSelectedPrompt(fullTemplate);
    }
    setIsCreating(false);
    setSelectedFolder(null);
  };

  const handleUpdate = async (template: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'> & { folder?: string | null }) => {
    if (selectedPrompt) {
      updatePromptTemplate(selectedPrompt.id, template);
      const fullTemplate = useStore.getState().getPromptTemplateById(selectedPrompt.id);
      if (fullTemplate) {
        await saveToBackend({ ...fullTemplate, folder: template.folder } as PromptTemplate & { folder?: string | null });
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
            await saveToBackend({ ...fullTemplate, sourceFilename: filenameWithoutExt } as PromptTemplate & { sourceFilename: string });
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
      <div className="w-[400px] bg-white border-r border-slate-200 flex flex-col">
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

        {/* Folder Actions */}
        <div className="px-4 py-2 border-b border-slate-200 flex items-center gap-2">
          {isCreatingFolder ? (
            <div className="flex-1 flex items-center gap-2">
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newFolderName.trim()) {
                    createFolder(newFolderName.trim());
                    setNewFolderName('');
                    setIsCreatingFolder(false);
                  } else if (e.key === 'Escape') {
                    setNewFolderName('');
                    setIsCreatingFolder(false);
                  }
                }}
                placeholder="Folder name..."
                autoFocus
                className="flex-1 px-2 py-1 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <button
                onClick={() => {
                  if (newFolderName.trim()) {
                    createFolder(newFolderName.trim());
                    setNewFolderName('');
                    setIsCreatingFolder(false);
                  }
                }}
                className="px-2 py-1 bg-indigo-500 text-white rounded text-sm hover:bg-indigo-600"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setNewFolderName('');
                  setIsCreatingFolder(false);
                }}
                className="px-2 py-1 text-slate-500 hover:text-slate-700 text-sm"
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => setIsCreatingFolder(true)}
                className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                New Folder
              </button>
              <span className="text-xs text-slate-400">
                {folders.length} folder{folders.length !== 1 ? 's' : ''}, {promptTemplates.length} prompt{promptTemplates.length !== 1 ? 's' : ''}
              </span>
            </>
          )}
        </div>

        {/* Prompt List with Folders */}
        <div className="flex-1 overflow-y-auto">
          {/* Root level prompts */}
          <div
            onDragOver={(e) => handleDragOver(e, '__root__')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, null)}
          >
            <button
              onClick={() => toggleFolder('__root__')}
              className={clsx(
                'w-full px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2 hover:bg-slate-100 transition-colors',
                dragOverFolder === '__root__' && 'bg-indigo-100 border-indigo-300'
              )}
            >
              {expandedFolders.has('__root__') ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              )}
              <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs font-medium text-slate-600">Root</span>
              <span className="text-xs text-slate-400">({groupedByFolder['__root__']?.length || 0})</span>
            </button>
            {expandedFolders.has('__root__') &&
              groupedByFolder['__root__']?.map((prompt) => (
                <div
                  key={prompt.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, prompt.id, null)}
                  onDragEnd={handleDragEnd}
                  onClick={() => {
                    setSelectedPrompt(prompt);
                    setIsCreating(false);
                  }}
                  className={clsx(
                    'w-full pl-12 pr-4 py-2.5 text-left border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-grab active:cursor-grabbing',
                    selectedPrompt?.id === prompt.id && 'bg-indigo-50 border-l-2 border-l-indigo-500',
                    draggedPrompt?.id === prompt.id && 'opacity-50'
                  )}
                >
                  <div className="flex items-start gap-2">
                    <FileText className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm text-slate-800 truncate">{prompt.name}</div>
                      {prompt.description && (
                        <div className="text-xs text-slate-500 truncate mt-0.5">{prompt.description}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>

          {/* Folders */}
          {folders.map((folder) => (
            <div
              key={folder.name}
              onDragOver={(e) => handleDragOver(e, folder.name)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, folder.name)}
            >
              <div
                className={clsx(
                  'w-full pl-4 pr-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2 hover:bg-slate-100 group transition-colors',
                  dragOverFolder === folder.name && 'bg-indigo-100 border-indigo-300'
                )}
              >
                <button
                  onClick={() => toggleFolder(folder.name)}
                  className="flex items-center gap-2 flex-1 text-left"
                >
                  {expandedFolders.has(folder.name) ? (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  )}
                  <Folder className="w-3.5 h-3.5 text-indigo-500" />
                  {editingFolder === folder.name ? (
                    <input
                      type="text"
                      defaultValue={folder.name}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const newName = (e.target as HTMLInputElement).value.trim();
                          if (newName && newName !== folder.name) {
                            renameFolder(folder.name, newName);
                          }
                          setEditingFolder(null);
                        } else if (e.key === 'Escape') {
                          setEditingFolder(null);
                        }
                      }}
                      onBlur={(e) => {
                        const newName = e.target.value.trim();
                        if (newName && newName !== folder.name) {
                          renameFolder(folder.name, newName);
                        }
                        setEditingFolder(null);
                      }}
                      className="px-1 py-0.5 border border-indigo-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    />
                  ) : (
                    <span className="text-xs font-medium text-slate-600">{folder.name}</span>
                  )}
                  <span className="text-xs text-slate-400">({groupedByFolder[folder.name]?.length || 0})</span>
                </button>
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setFolderMenuOpen(folderMenuOpen === folder.name ? null : folder.name);
                    }}
                    className="p-1 rounded hover:bg-slate-200 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreVertical className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                  {folderMenuOpen === folder.name && (
                    <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 py-1 min-w-[140px]">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFolder(folder.name);
                          setIsCreating(true);
                          setSelectedPrompt(null);
                          setFolderMenuOpen(null);
                        }}
                        className="w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        New Prompt
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingFolder(folder.name);
                          setFolderMenuOpen(null);
                        }}
                        className="w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Rename
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteFolder(folder.name);
                          setFolderMenuOpen(null);
                        }}
                        className="w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {expandedFolders.has(folder.name) &&
                groupedByFolder[folder.name]?.map((prompt) => (
                  <div
                    key={prompt.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, prompt.id, folder.name)}
                    onDragEnd={handleDragEnd}
                    onClick={() => {
                      setSelectedPrompt(prompt);
                      setIsCreating(false);
                    }}
                    className={clsx(
                      'w-full pl-12 pr-4 py-2.5 text-left border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-grab active:cursor-grabbing',
                      selectedPrompt?.id === prompt.id && 'bg-indigo-50 border-l-2 border-l-indigo-500',
                      draggedPrompt?.id === prompt.id && 'opacity-50'
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <FileText className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm text-slate-800 truncate">{prompt.name}</div>
                        {prompt.description && (
                          <div className="text-xs text-slate-500 truncate mt-0.5">{prompt.description}</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          ))}

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
      <div className="flex-1 flex flex-col min-w-0">
        {isCreating ? (
          <PromptEditor
            onSave={handleCreate}
            categories={categories}
            folders={folders}
            initialFolder={selectedFolder}
          />
        ) : selectedPrompt ? (
          <PromptEditor
            key={selectedPrompt.id}
            template={selectedPrompt as PromptTemplate & { folder?: string | null }}
            onSave={handleUpdate}
            onDelete={() => handleDelete(selectedPrompt.id)}
            onDuplicate={() => handleDuplicate(selectedPrompt)}
            onExport={() => handleExport(selectedPrompt)}
            onCopy={(text) => copyToClipboard(text, selectedPrompt.id)}
            copied={copiedId === selectedPrompt.id}
            categories={categories}
            folders={folders}
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
  template?: PromptTemplate & { folder?: string | null };
  onSave: (template: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'> & { folder?: string | null }) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onExport?: () => void;
  onCopy?: (text: string) => void;
  copied?: boolean;
  categories: string[];
  folders?: { name: string; promptCount: number }[];
  initialFolder?: string | null;
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
  folders = [],
  initialFolder,
}: PromptEditorProps) {
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [category, setCategory] = useState(template?.category || '');
  const [folder, setFolder] = useState<string | null>(template?.folder ?? initialFolder ?? null);
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
      folder,
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
    <div className="flex-1 flex flex-col h-full w-full">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-slate-200 bg-white">
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
      <div className="flex-1 overflow-y-auto p-10 space-y-8 bg-white">
        {/* Basic Info */}
        <div className="grid grid-cols-2 gap-8">
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

        <div className="grid grid-cols-2 gap-8">
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
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Folder</label>
            <div className="relative">
              <Folder className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select
                value={folder || ''}
                onChange={(e) => setFolder(e.target.value || null)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 appearance-none bg-white"
              >
                <option value="">Root (no folder)</option>
                {folders.map((f) => (
                  <option key={f.name} value={f.name}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Tags, Priority, Version */}
        <div className="grid grid-cols-3 gap-6">
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
            rows={30}
            className="w-full px-4 py-4 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y min-h-[500px]"
          />
        </div>

        {/* Output Extraction */}
        <div className="bg-slate-50 rounded-lg p-6 space-y-5">
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
