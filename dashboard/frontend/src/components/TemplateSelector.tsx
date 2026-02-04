import { useState, useRef, useEffect } from 'react';
import { ChevronDown, FileCode } from 'lucide-react';
import { promptWorkflowTemplates, type PromptWorkflowTemplate } from '../promptWorkflowTemplates';
import clsx from 'clsx';

interface TemplateSelectorProps {
  selectedTemplate: string | null;
  onSelectTemplate: (template: PromptWorkflowTemplate) => void;
}

export default function TemplateSelector({ selectedTemplate, onSelectTemplate }: TemplateSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (template: PromptWorkflowTemplate) => {
    onSelectTemplate(template);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-sm',
          'hover:border-indigo-400 hover:bg-indigo-50',
          isOpen ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-white'
        )}
      >
        <FileCode className="w-4 h-4 text-indigo-500" />
        <span className="text-slate-700 font-medium">Templates</span>
        <ChevronDown className={clsx(
          'w-4 h-4 text-slate-400 transition-transform',
          isOpen && 'rotate-180'
        )} />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-80 bg-white border border-slate-200 rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
              Workflow Templates
            </span>
          </div>
          <div className="max-h-[400px] overflow-y-auto p-2 space-y-1">
            {promptWorkflowTemplates.map((template) => (
              <button
                key={template.id}
                onClick={() => handleSelect(template)}
                className={clsx(
                  'w-full text-left px-3 py-2 rounded-lg transition-all',
                  'hover:bg-indigo-50',
                  selectedTemplate === template.id
                    ? 'bg-indigo-50 ring-1 ring-indigo-200'
                    : 'bg-white'
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{template.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className={clsx(
                      'text-sm font-medium truncate',
                      selectedTemplate === template.id
                        ? 'text-indigo-700'
                        : 'text-slate-700'
                    )}>
                      {template.name}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {template.description}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <div className="p-2 border-t border-slate-100 bg-slate-50">
            <p className="text-[10px] text-slate-400">
              Use <code className="bg-slate-200 px-1 rounded">{'{{variables}}'}</code> in
              prompt templates for data flow between blocks.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
