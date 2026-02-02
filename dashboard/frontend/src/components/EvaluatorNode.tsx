import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Scale, Loader2, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';
import clsx from 'clsx';

interface EvaluatorNodeProps {
  data: {
    label: string;
    status: 'idle' | 'evaluating' | 'approved' | 'rejected';
    iteration?: number;
    maxIterations?: number;
    feedback?: string;
    score?: number;
  };
}

function EvaluatorNode({ data }: EvaluatorNodeProps) {
  const { status, iteration = 0, maxIterations = 3, feedback, score } = data;

  return (
    <div className={clsx(
      'bg-white rounded-lg shadow-md border-2 w-[240px] overflow-hidden',
      status === 'evaluating' && 'border-amber-400',
      status === 'approved' && 'border-green-400',
      status === 'rejected' && 'border-red-400',
      status === 'idle' && 'border-slate-300'
    )}>
      {/* Header */}
      <div className={clsx(
        'px-3 py-2 border-b flex items-center justify-between',
        status === 'evaluating' && 'bg-amber-50',
        status === 'approved' && 'bg-green-50',
        status === 'rejected' && 'bg-red-50',
        status === 'idle' && 'bg-slate-50'
      )}>
        <div className="flex items-center gap-2">
          <Scale className={clsx(
            'w-4 h-4',
            status === 'evaluating' && 'text-amber-600',
            status === 'approved' && 'text-green-600',
            status === 'rejected' && 'text-red-600',
            status === 'idle' && 'text-slate-500'
          )} />
          <span className="font-semibold text-slate-700 text-sm">Evaluator</span>
        </div>
        {status === 'evaluating' && <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />}
        {status === 'approved' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
        {status === 'rejected' && <XCircle className="w-4 h-4 text-red-500" />}
      </div>

      {/* Iteration counter */}
      <div className="px-3 py-2 border-b">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Iteration</span>
          <div className="flex items-center gap-1">
            <RotateCcw className="w-3 h-3 text-slate-400" />
            <span className="font-medium">{iteration}/{maxIterations}</span>
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-1 h-1 bg-slate-200 rounded-full overflow-hidden">
          <div
            className={clsx(
              'h-full transition-all',
              status === 'approved' ? 'bg-green-500' : 'bg-amber-500'
            )}
            style={{ width: `${(iteration / maxIterations) * 100}%` }}
          />
        </div>
      </div>

      {/* Score if available */}
      {score !== undefined && (
        <div className="px-3 py-2 border-b">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Quality Score</span>
            <span className={clsx(
              'text-sm font-bold',
              score >= 0.8 ? 'text-green-600' : score >= 0.5 ? 'text-amber-600' : 'text-red-600'
            )}>
              {Math.round(score * 100)}%
            </span>
          </div>
        </div>
      )}

      {/* Feedback */}
      {feedback && (
        <div className="px-3 py-2">
          <div className="text-xs text-slate-500 mb-1">Feedback</div>
          <div className={clsx(
            'text-xs p-2 rounded border line-clamp-3',
            status === 'rejected'
              ? 'bg-red-50 text-red-700 border-red-200'
              : 'bg-green-50 text-green-700 border-green-200'
          )}>
            {feedback}
          </div>
        </div>
      )}

      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-amber-500 border-2 border-white"
      />

      {/* Output handles: approved (right), rejected (bottom) */}
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
