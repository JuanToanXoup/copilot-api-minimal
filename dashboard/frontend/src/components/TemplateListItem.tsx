import { Download, Pencil, Trash2 } from 'lucide-react';
import type { PromptTemplate } from '../types';

interface TemplateListItemProps {
  template: PromptTemplate;
  onEdit: () => void;
  onDelete: () => void;
  onExport: () => void;
}

export default function TemplateListItem({
  template,
  onEdit,
  onDelete,
  onExport,
}: TemplateListItemProps) {
  return (
    <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 group">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-slate-700 truncate">
          {template.name}
        </div>
        {template.description && (
          <div className="text-xs text-slate-400 truncate">
            {template.description}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onExport}
          className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600"
          title="Export as .md"
        >
          <Download className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onEdit}
          className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600"
          title="Edit"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onDelete}
          className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-600"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
