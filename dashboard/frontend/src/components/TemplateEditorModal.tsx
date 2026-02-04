import { useState } from 'react';
import { X, Save } from 'lucide-react';
import clsx from 'clsx';
import type { PromptTemplate, ExtractionMode } from '../types';

interface TemplateEditorModalProps {
  template?: PromptTemplate;
  onSave: (template: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}

export default function TemplateEditorModal({ template, onSave, onCancel }: TemplateEditorModalProps) {
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
