import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { CheckCircle, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import clsx from 'clsx';

interface EvaluatorNodeProps {
  data: {
    label: string;
    description?: string;
    status: 'idle' | 'evaluating' | 'approved' | 'rejected';
    iteration?: number;
    maxIterations?: number;
  };
  selected?: boolean;
}

function EvaluatorNode({ data, selected }: EvaluatorNodeProps) {
  const { label, description, status, iteration = 0, maxIterations = 3 } = data;

  return (
    <div className={clsx(
      'bg-white rounded-lg shadow-md border-2 w-[270px] transition-all',
      status === 'evaluating' && 'border-emerald-400',
      status === 'approved' && 'border-green-400',
      status === 'rejected' && 'border-red-400',
      status === 'idle' && 'border-emerald-200',
      selected && 'ring-2 ring-emerald-500 ring-offset-2'
    )}>
      {/* Header */}
      <div className={clsx(
        'px-3 py-2 flex items-center gap-2',
        status === 'evaluating' && 'bg-emerald-50',
        status === 'approved' && 'bg-green-50',
        status === 'rejected' && 'bg-red-50',
        status === 'idle' && 'bg-emerald-50'
      )}>
        <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
        <span className="font-medium text-sm text-slate-700 truncate flex-1">
          {label || 'Evaluator'}
        </span>
        {status === 'evaluating' && <Loader2 className="w-3.5 h-3.5 text-emerald-500 animate-spin" />}
        {status === 'approved' && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
        {status === 'rejected' && <XCircle className="w-3.5 h-3.5 text-red-500" />}
      </div>

      {/* Info */}
      <div className="px-3 py-2 border-t border-slate-100">
        {description ? (
          <p className="text-xs text-slate-500 truncate">{description}</p>
        ) : (
          <p className="text-xs text-slate-400">
            {iteration}/{maxIterations} iterations
          </p>
        )}
      </div>

      {/* Branch indicators */}
      <div className="px-3 py-1.5 border-t border-slate-100 flex justify-between text-[10px]">
        <span className={clsx('px-1.5 py-0.5 rounded', status === 'approved' ? 'bg-green-100 text-green-700 font-medium' : 'text-slate-400')}>
          Approved →
        </span>
        <span className={clsx('px-1.5 py-0.5 rounded', status === 'rejected' ? 'bg-red-100 text-red-700 font-medium' : 'text-slate-400')}>
          ↓ Retry
        </span>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-emerald-500 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="approved"
        className="w-3 h-3 bg-green-500 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="rejected"
        className="w-3 h-3 bg-red-500 border-2 border-white"
      />
    </div>
  );
}

export default memo(EvaluatorNode);
