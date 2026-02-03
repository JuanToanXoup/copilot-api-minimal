import { useState, useEffect } from 'react';
import { X, Save, RotateCcw, Loader2, Info, Code } from 'lucide-react';
import clsx from 'clsx';
import type { PromptMetrics } from '../types';

// Common template variables used in prompts
const templateVariables = [
  { name: '{{test_file}}', description: 'Path to the failing test file' },
  { name: '{{error_message}}', description: 'The error message from the test failure' },
  { name: '{{stack_trace}}', description: 'Full stack trace if available' },
  { name: '{{source_code}}', description: 'Relevant source code context' },
  { name: '{{previous_attempts}}', description: 'History of previous fix attempts' },
  { name: '{{classification}}', description: 'Failure classification result' },
  { name: '{{inspection_results}}', description: 'Results from code inspection' },
];

interface PromptEditorProps {
  promptMetrics: PromptMetrics;
  onClose: () => void;
  onGetPrompt?: (agentType: string) => Promise<string>;
  onUpdatePrompt?: (agentType: string, content: string) => Promise<void>;
}

export default function PromptEditor({
  promptMetrics,
  onClose,
  onGetPrompt,
  onUpdatePrompt,
}: PromptEditorProps) {
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showVariables, setShowVariables] = useState(true);

  // Load prompt content
  useEffect(() => {
    const loadPrompt = async () => {
      setIsLoading(true);
      setError(null);

      if (onGetPrompt) {
        try {
          const promptContent = await onGetPrompt(promptMetrics.agent_type);
          setContent(promptContent);
          setOriginalContent(promptContent);
        } catch (err) {
          setError('Failed to load prompt content');
          // Use placeholder for demo
          const placeholder = `# ${promptMetrics.prompt_name}\n\nPrompt content would be loaded from the backend.\n\nVersion: ${promptMetrics.version}\nAgent Type: ${promptMetrics.agent_type}`;
          setContent(placeholder);
          setOriginalContent(placeholder);
        }
      } else {
        // Demo mode - show placeholder
        const placeholder = `# ${promptMetrics.prompt_name}\n\nYou are a ${promptMetrics.agent_type} agent responsible for analyzing and fixing test failures.\n\n## Context\n{{test_file}}\n{{error_message}}\n\n## Instructions\nAnalyze the failure and provide a detailed response.\n\n## Expected Output\nProvide your analysis in a structured format.`;
        setContent(placeholder);
        setOriginalContent(placeholder);
      }

      setIsLoading(false);
    };

    loadPrompt();
  }, [promptMetrics, onGetPrompt]);

  const handleSave = async () => {
    if (!onUpdatePrompt) return;

    setIsSaving(true);
    setError(null);

    try {
      await onUpdatePrompt(promptMetrics.agent_type, content);
      setOriginalContent(content);
      onClose();
    } catch (err) {
      setError('Failed to save prompt');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevert = () => {
    setContent(originalContent);
    setError(null);
  };

  const hasChanges = content !== originalContent;

  // Insert template variable at cursor
  const insertVariable = (variable: string) => {
    setContent((prev) => prev + variable);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-[800px] max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <Code className="w-5 h-5 text-blue-500" />
              Edit Prompt
            </h3>
            <div className="text-xs text-slate-500 mt-1">
              {promptMetrics.prompt_name} | {promptMetrics.agent_type} | v{promptMetrics.version}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex min-h-0">
          {/* Editor */}
          <div className="flex-1 flex flex-col min-w-0">
            {isLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
              </div>
            ) : (
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className={clsx(
                  'flex-1 w-full p-4 font-mono text-sm resize-none',
                  'bg-slate-50 border-none focus:outline-none',
                  'placeholder-slate-400'
                )}
                placeholder="Enter prompt content..."
                spellCheck={false}
              />
            )}
          </div>

          {/* Variables Sidebar */}
          {showVariables && (
            <div className="w-64 border-l border-slate-200 bg-slate-50 flex flex-col">
              <div className="px-4 py-3 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Template Variables
                  </span>
                  <button
                    onClick={() => setShowVariables(false)}
                    className="p-1 rounded hover:bg-slate-200 text-slate-400"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {templateVariables.map((variable) => (
                  <button
                    key={variable.name}
                    onClick={() => insertVariable(variable.name)}
                    className="w-full text-left p-2 rounded hover:bg-slate-100 transition-colors group"
                  >
                    <div className="font-mono text-xs text-blue-600 group-hover:text-blue-700">
                      {variable.name}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {variable.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="px-6 py-2 bg-red-50 border-t border-red-200">
            <p className="text-xs text-red-600">{error}</p>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {!showVariables && (
              <button
                onClick={() => setShowVariables(true)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
              >
                <Info className="w-4 h-4" />
                Show Variables
              </button>
            )}
            {hasChanges && (
              <span className="text-xs text-amber-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Unsaved changes
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRevert}
              disabled={!hasChanges || isSaving}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded transition-colors',
                hasChanges && !isSaving
                  ? 'text-slate-600 hover:text-slate-800 hover:bg-slate-200'
                  : 'text-slate-400 cursor-not-allowed'
              )}
            >
              <RotateCcw className="w-4 h-4" />
              Revert
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges || isSaving || !onUpdatePrompt}
              className={clsx(
                'flex items-center gap-1.5 px-4 py-1.5 rounded text-sm font-medium transition-colors',
                hasChanges && !isSaving && onUpdatePrompt
                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              )}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
