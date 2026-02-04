import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { FileText, Loader2, CheckCircle2, XCircle, Circle } from 'lucide-react';
import clsx from 'clsx';
import { useStore } from '../store';
import type { PromptBlockNodeData } from '../types';

// Re-export for backwards compatibility
export { extractVariables } from '../utils/templateVariables';

interface PromptBlockNodeProps {
  id: string;
  data: PromptBlockNodeData;
  selected?: boolean;
}

function PromptBlockNode({ data, selected }: PromptBlockNodeProps) {
  const promptTemplates = useStore((state) => state.promptTemplates);
  const agents = useStore((state) => state.agents);

  const { label, description, status = 'idle', agentId, promptTemplateId } = data;

  // Get template and agent names for display
  const template = promptTemplates.find((t) => t.id === promptTemplateId);
  const agent = agents.find((a) => a.instance_id === agentId);

  const StatusIcon = () => {
    switch (status) {
      case 'running':
        return <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />;
      case 'success':
        return <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />;
      case 'error':
        return <XCircle className="w-3.5 h-3.5 text-red-500" />;
      case 'waiting':
        return <Circle className="w-3.5 h-3.5 text-amber-500 animate-pulse" />;
      default:
        return null;
    }
  };

  return (
    <div
      className={clsx(
        'bg-white rounded-lg shadow-md border-2 w-[270px] transition-all',
        status === 'running' ? 'border-blue-400' :
        status === 'success' ? 'border-green-400' :
        status === 'error' ? 'border-red-400' :
        status === 'waiting' ? 'border-amber-400' : 'border-indigo-200',
        selected && 'ring-2 ring-indigo-500 ring-offset-2'
      )}
    >
      {/* Header */}
      <div className={clsx(
        'px-3 py-2 flex items-center gap-2',
        status === 'running' ? 'bg-blue-50' :
        status === 'success' ? 'bg-green-50' :
        status === 'error' ? 'bg-red-50' :
        status === 'waiting' ? 'bg-amber-50' : 'bg-indigo-50'
      )}>
        <FileText className="w-4 h-4 text-indigo-600 flex-shrink-0" />
        <span className="font-medium text-sm text-slate-700 truncate flex-1">
          {label || 'Prompt Block'}
        </span>
        <StatusIcon />
      </div>

      {/* Description or info */}
      <div className="px-3 py-2 border-t border-slate-100 space-y-1">
        {description ? (
          <p className="text-xs text-slate-500 truncate">{description}</p>
        ) : (
          <>
            {template && (
              <p className="text-xs text-slate-400 truncate">
                <span className="text-slate-500">Template:</span> {template.name}
              </p>
            )}
            {agent && (
              <p className="text-xs text-slate-400 truncate">
                <span className="text-slate-500">Agent:</span> :{agent.port}
              </p>
            )}
            {!template && !agent && (
              <p className="text-xs text-slate-400 italic">Click to configure</p>
            )}
          </>
        )}
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-indigo-500 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-indigo-500 border-2 border-white"
      />
    </div>
  );
}

export default memo(PromptBlockNode);
