import { Settings2 } from 'lucide-react';
import type { PromptTemplate } from '../../types';

interface TemplateSelectorProps {
  templates: PromptTemplate[];
  selectedTemplateId: string | null;
  selectedTemplate: PromptTemplate | undefined;
  onChange: (templateId: string) => void;
}

export default function TemplateSelector({
  templates,
  selectedTemplateId,
  selectedTemplate,
  onChange,
}: TemplateSelectorProps) {
  return (
    <div className="px-3 py-2 border-b bg-slate-50">
      <div className="flex items-center gap-2 mb-2">
        <Settings2 className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
          Prompt Template
        </span>
      </div>
      <select
        value={selectedTemplateId || ''}
        onChange={(e) => onChange(e.target.value)}
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full px-2 py-1.5 rounded text-sm border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 nodrag"
      >
        <option value="">Select template...</option>
        {templates.map((template) => (
          <option key={template.id} value={template.id}>
            {template.name}
          </option>
        ))}
      </select>
      {selectedTemplate?.description && (
        <p className="text-[10px] text-slate-400 mt-1">{selectedTemplate.description}</p>
      )}
    </div>
  );
}
