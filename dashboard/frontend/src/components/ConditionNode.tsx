import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { GitBranch, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import clsx from 'clsx';

interface ConditionNodeProps {
  data: {
    label: string;
    description?: string;
    status: 'idle' | 'evaluating' | 'true' | 'false';
    variable?: string;
    operator?: string;
    value?: string;
  };
  selected?: boolean;
}

function ConditionNode({ data, selected }: ConditionNodeProps) {
  const { label, description, status, variable = '$result', operator = '==', value = 'true' } = data;

  const expression = `${variable} ${operator} ${value}`;

  return (
    <div className={clsx(
      'bg-white rounded-lg shadow-md border-2 w-[200px] transition-all',
      status === 'evaluating' && 'border-amber-400',
      status === 'true' && 'border-green-400',
      status === 'false' && 'border-red-400',
      status === 'idle' && 'border-amber-200',
      selected && 'ring-2 ring-amber-500 ring-offset-2'
    )}>
      {/* Header */}
      <div className={clsx(
        'px-3 py-2 flex items-center gap-2',
        status === 'evaluating' && 'bg-amber-50',
        status === 'true' && 'bg-green-50',
        status === 'false' && 'bg-red-50',
        status === 'idle' && 'bg-amber-50'
      )}>
        <GitBranch className="w-4 h-4 text-amber-600 flex-shrink-0" />
        <span className="font-medium text-sm text-slate-700 truncate flex-1">
          {label || 'Condition'}
        </span>
        {status === 'evaluating' && <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin" />}
        {status === 'true' && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
        {status === 'false' && <XCircle className="w-3.5 h-3.5 text-red-500" />}
      </div>

      {/* Info */}
      <div className="px-3 py-2 border-t border-slate-100">
        {description ? (
          <p className="text-xs text-slate-500 truncate">{description}</p>
        ) : (
          <code className="text-xs text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-mono">
            {expression}
          </code>
        )}
      </div>

      {/* Branch indicators */}
      <div className="px-3 py-1.5 border-t border-slate-100 flex justify-between text-[10px]">
        <span className={clsx('px-1.5 py-0.5 rounded', status === 'true' ? 'bg-green-100 text-green-700 font-medium' : 'text-slate-400')}>
          True →
        </span>
        <span className={clsx('px-1.5 py-0.5 rounded', status === 'false' ? 'bg-red-100 text-red-700 font-medium' : 'text-slate-400')}>
          False →
        </span>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-amber-500 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="true"
        style={{ top: '35%' }}
        className="w-3 h-3 bg-green-500 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="false"
        style={{ top: '65%' }}
        className="w-3 h-3 bg-red-500 border-2 border-white"
      />
    </div>
  );
}

export default memo(ConditionNode);
