import { promptWorkflowTemplates, type PromptWorkflowTemplate } from '../promptWorkflowTemplates';
import clsx from 'clsx';

interface TemplateSelectorProps {
  selectedTemplate: string | null;
  onSelectTemplate: (template: PromptWorkflowTemplate) => void;
}

export default function TemplateSelector({ selectedTemplate, onSelectTemplate }: TemplateSelectorProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
        Workflow Templates
      </h3>
      <div className="space-y-1 max-h-[400px] overflow-y-auto">
        {promptWorkflowTemplates.map((template) => (
          <button
            key={template.id}
            onClick={() => onSelectTemplate(template)}
            className={clsx(
              'w-full text-left px-3 py-2 rounded-lg transition-all',
              'hover:bg-indigo-50 hover:border-indigo-300',
              'border',
              selectedTemplate === template.id
                ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-200'
                : 'bg-white border-slate-200'
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

      {/* Help text */}
      <div className="pt-2 border-t border-slate-100">
        <p className="text-[10px] text-slate-400">
          Use <code className="bg-slate-100 px-1 rounded">{'{{variables}}'}</code> in
          prompt templates for data flow between blocks.
        </p>
      </div>
    </div>
  );
}
