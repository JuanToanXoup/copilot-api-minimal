import { workflowTemplates, type WorkflowTemplate } from '../workflowTemplates';
import clsx from 'clsx';

interface TemplateSelectorProps {
  selectedTemplate: string | null;
  onSelectTemplate: (template: WorkflowTemplate) => void;
}

export default function TemplateSelector({ selectedTemplate, onSelectTemplate }: TemplateSelectorProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
        Workflow Patterns
      </h3>
      <div className="space-y-1">
        {workflowTemplates.map((template) => (
          <button
            key={template.id}
            onClick={() => onSelectTemplate(template)}
            className={clsx(
              'w-full text-left px-3 py-2 rounded-lg transition-all',
              'hover:bg-blue-50 hover:border-blue-300',
              'border',
              selectedTemplate === template.id
                ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200'
                : 'bg-white border-slate-200'
            )}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{template.icon}</span>
              <div className="flex-1 min-w-0">
                <div className={clsx(
                  'text-sm font-medium truncate',
                  selectedTemplate === template.id ? 'text-blue-700' : 'text-slate-700'
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
    </div>
  );
}
