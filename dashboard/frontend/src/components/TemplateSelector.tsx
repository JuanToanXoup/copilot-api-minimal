import { useState } from 'react';
import { workflowTemplates, type WorkflowTemplate } from '../workflowTemplates';
import { promptWorkflowTemplates, type PromptWorkflowTemplate } from '../promptWorkflowTemplates';
import clsx from 'clsx';

type AnyTemplate = WorkflowTemplate | PromptWorkflowTemplate;

interface TemplateSelectorProps {
  selectedTemplate: string | null;
  onSelectTemplate: (template: AnyTemplate) => void;
}

export default function TemplateSelector({ selectedTemplate, onSelectTemplate }: TemplateSelectorProps) {
  const [activeTab, setActiveTab] = useState<'prompt' | 'agent'>('prompt');

  const templates = activeTab === 'prompt' ? promptWorkflowTemplates : workflowTemplates;

  return (
    <div className="space-y-2">
      {/* Tab selector */}
      <div className="flex rounded-lg bg-slate-100 p-0.5">
        <button
          onClick={() => setActiveTab('prompt')}
          className={clsx(
            'flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all',
            activeTab === 'prompt'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-800'
          )}
        >
          Prompt Workflows
        </button>
        <button
          onClick={() => setActiveTab('agent')}
          className={clsx(
            'flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all',
            activeTab === 'agent'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-800'
          )}
        >
          Agent Patterns
        </button>
      </div>

      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
        {activeTab === 'prompt' ? 'Prompt Workflows' : 'Agent Patterns'}
      </h3>
      <div className="space-y-1 max-h-[300px] overflow-y-auto">
        {templates.map((template) => (
          <button
            key={template.id}
            onClick={() => onSelectTemplate(template)}
            className={clsx(
              'w-full text-left px-3 py-2 rounded-lg transition-all',
              activeTab === 'prompt'
                ? 'hover:bg-indigo-50 hover:border-indigo-300'
                : 'hover:bg-blue-50 hover:border-blue-300',
              'border',
              selectedTemplate === template.id
                ? activeTab === 'prompt'
                  ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-200'
                  : 'bg-blue-50 border-blue-300 ring-1 ring-blue-200'
                : 'bg-white border-slate-200'
            )}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{template.icon}</span>
              <div className="flex-1 min-w-0">
                <div className={clsx(
                  'text-sm font-medium truncate',
                  selectedTemplate === template.id
                    ? activeTab === 'prompt' ? 'text-indigo-700' : 'text-blue-700'
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
          {activeTab === 'prompt' ? (
            <>
              <strong>Prompt Workflows</strong> use customizable prompt templates with{' '}
              <code className="bg-slate-100 px-1 rounded">{'{{variables}}'}</code> for data flow.
            </>
          ) : (
            <>
              <strong>Agent Patterns</strong> use predefined roles and output validation.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
