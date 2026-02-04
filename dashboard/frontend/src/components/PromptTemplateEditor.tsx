import { useState, useRef, useMemo } from 'react';
import {
  FileText,
  Trash2,
  Save,
  Download,
  Copy,
  Check,
  Tag,
  Folder,
} from 'lucide-react';
import clsx from 'clsx';
import type { PromptTemplate, ExtractionMode, PromptPriority } from '../types';
import type { FolderInfo } from '../services/promptService';

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

export interface PromptTemplateEditorProps {
  template?: PromptTemplate & { folder?: string | null };
  onSave: (template: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'> & { folder?: string | null }) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onExport?: () => void;
  onCopy?: (text: string) => void;
  copied?: boolean;
  categories: string[];
  folders?: FolderInfo[];
  initialFolder?: string | null;
}

export default function PromptTemplateEditor({
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
}: PromptTemplateEditorProps) {
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

  // Line numbers editor refs and scroll state
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  // Calculate line numbers
  const lineNumbers = useMemo(() => {
    const lines = promptTemplate.split('\n');
    return lines.map((_, i) => i + 1);
  }, [promptTemplate]);

  // Sync scroll between textarea and line numbers
  const handleScroll = () => {
    if (textareaRef.current) {
      setScrollTop(textareaRef.current.scrollTop);
    }
  };

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

  // Extract variables from template - supports both {{variable}} and $VARIABLE formats
  const variables = useMemo(() => {
    const mustacheMatches = promptTemplate.match(/\{\{(\w+)\}\}/g) || [];
    const dollarMatches = promptTemplate.match(/\$([A-Z_][A-Z0-9_]*)/g) || [];
    const mustacheVars = mustacheMatches.map((m) => ({ format: 'mustache' as const, name: m.slice(2, -2), display: m }));
    const dollarVars = dollarMatches.map((m) => ({ format: 'dollar' as const, name: m.slice(1), display: m }));
    // Dedupe by display value
    const seen = new Set<string>();
    return [...mustacheVars, ...dollarVars].filter((v) => {
      if (seen.has(v.display)) return false;
      seen.add(v.display);
      return true;
    });
  }, [promptTemplate]);

  return (
    <div className="flex-1 flex h-full w-full">
      {/* Middle - Template Editor */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-indigo-500" />
            <h2 className="font-semibold text-slate-800">{template ? 'Edit Prompt' : 'New Prompt'}</h2>
            {variables.length > 0 && (
              <div className="flex items-center gap-1 ml-4">
                <span className="text-xs text-slate-500">Variables:</span>
                {variables.map((v) => (
                  <span
                    key={v.display}
                    className={clsx(
                      'px-1.5 py-0.5 rounded text-xs font-mono',
                      v.format === 'mustache' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                    )}
                  >
                    {v.display}
                  </span>
                ))}
              </div>
            )}
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

        {/* Template Editor - Full Height with Line Numbers */}
        <div className="flex-1 flex flex-col p-6 bg-slate-50 min-h-0">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-slate-700">Prompt Template</label>
            <p className="text-xs text-slate-500">Use {'{{variable}}'} or $VARIABLE syntax for dynamic values</p>
          </div>
          <div className="flex-1 flex border border-slate-200 rounded-lg bg-white focus-within:ring-2 focus-within:ring-indigo-400 min-h-0 overflow-hidden">
            {/* Line numbers gutter */}
            <div
              className="flex-shrink-0 bg-slate-50 border-r border-slate-200 overflow-hidden select-none"
              style={{ width: '50px' }}
            >
              <div
                className="pt-4 pb-4"
                style={{ transform: `translateY(-${scrollTop}px)` }}
              >
                {lineNumbers.map((num) => (
                  <div
                    key={num}
                    className="text-right pr-3 text-xs font-mono text-slate-400 leading-[21px] h-[21px]"
                  >
                    {num}
                  </div>
                ))}
              </div>
            </div>
            {/* Editor textarea */}
            <textarea
              ref={textareaRef}
              value={promptTemplate}
              onChange={(e) => setPromptTemplate(e.target.value)}
              onScroll={handleScroll}
              placeholder="Enter your prompt template..."
              className="flex-1 px-4 py-4 text-sm font-mono focus:outline-none resize-none leading-[21px] overflow-auto whitespace-pre"
              spellCheck={false}
              wrap="off"
            />
          </div>
        </div>
      </div>

      {/* Right Sidebar - Settings */}
      <div className="w-[350px] flex-shrink-0 border-l border-slate-200 bg-white flex flex-col overflow-y-auto">
        <div className="p-4 border-b border-slate-200">
          <h3 className="font-medium text-slate-700">Settings</h3>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Name */}
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

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of what this prompt does"
              rows={4}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
            />
          </div>

          {/* Category */}
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

          {/* Folder */}
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

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tags</label>
            <div className="flex flex-wrap gap-1 mb-2 min-h-[24px]">
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

          {/* Priority & Version */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as PromptPriority | '')}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="">None</option>
                <option value="P1">P1</option>
                <option value="P2">P2</option>
                <option value="P3">P3</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Version</label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="1.0.0"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>

          {/* Output Extraction */}
          <div className="bg-slate-50 rounded-lg p-4 space-y-4">
            <h4 className="text-sm font-medium text-slate-700">Output Extraction</h4>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Output Name</label>
              <input
                type="text"
                value={outputName}
                onChange={(e) => setOutputName(e.target.value)}
                placeholder="output"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Extraction Mode</label>
              <select
                value={extractionMode}
                onChange={(e) => setExtractionMode(e.target.value as ExtractionMode)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
              >
                <option value="full">Full Response</option>
                <option value="json">Parse as JSON</option>
                <option value="jsonpath">JSON Path</option>
                <option value="regex">Regex Extract</option>
                <option value="first_line">First Line</option>
              </select>
            </div>

            {(extractionMode === 'jsonpath' || extractionMode === 'regex') && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Pattern</label>
                <input
                  type="text"
                  value={extractionPattern}
                  onChange={(e) => setExtractionPattern(e.target.value)}
                  placeholder={extractionMode === 'jsonpath' ? '$.result.value' : '(\\d+)'}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                />
              </div>
            )}
          </div>

          {/* Metadata */}
          {template && (
            <div className="text-xs text-slate-400 space-y-1 pt-2 border-t border-slate-100">
              <p className="font-medium text-slate-500 mb-2">Metadata</p>
              <p>ID: {template.id}</p>
              <p>Created: {new Date(template.createdAt).toLocaleString()}</p>
              <p>Updated: {new Date(template.updatedAt).toLocaleString()}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
