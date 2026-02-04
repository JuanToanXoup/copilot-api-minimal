import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { GitFork, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import clsx from 'clsx';

interface ConditionNodeProps {
  data: {
    label: string;
    status: 'idle' | 'evaluating' | 'true' | 'false';
    expression?: string;
    variable?: string;
    operator?: '==' | '!=' | '>' | '<' | '>=' | '<=' | 'contains' | 'matches';
    value?: string;
    result?: boolean;
  };
}

function ConditionNode({ data }: ConditionNodeProps) {
  const {
    status,
    expression,
    variable = '$result',
    operator = '==',
    value = 'true',
    result
  } = data;

  const displayExpression = expression || `${variable} ${operator} ${value}`;

  return (
    <div className={clsx(
      'bg-white rounded-lg shadow-md border-2 w-[220px] overflow-hidden',
      status === 'evaluating' && 'border-amber-400',
      status === 'true' && 'border-green-400',
      status === 'false' && 'border-red-400',
      status === 'idle' && 'border-slate-300'
    )}>
      {/* Header */}
      <div className={clsx(
        'px-3 py-2 border-b flex items-center justify-between',
        status === 'evaluating' && 'bg-amber-50',
        status === 'true' && 'bg-green-50',
        status === 'false' && 'bg-red-50',
        status === 'idle' && 'bg-slate-50'
      )}>
        <div className="flex items-center gap-2">
          <GitFork className={clsx(
            'w-4 h-4',
            status === 'evaluating' && 'text-amber-600',
            status === 'true' && 'text-green-600',
            status === 'false' && 'text-red-600',
            status === 'idle' && 'text-slate-500'
          )} />
          <span className="font-semibold text-slate-700 text-sm">Condition</span>
        </div>
        {status === 'evaluating' && <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />}
        {status === 'true' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
        {status === 'false' && <XCircle className="w-4 h-4 text-red-500" />}
      </div>

      {/* Expression */}
      <div className="px-3 py-2 border-b">
        <div className="text-xs text-slate-500 mb-1">If</div>
        <div className="text-xs font-mono bg-slate-100 px-2 py-1.5 rounded text-slate-700 break-all">
          {displayExpression}
        </div>
      </div>

      {/* Branches */}
      <div className="px-3 py-2 space-y-1">
        <div className={clsx(
          'text-xs px-2 py-1 rounded flex items-center justify-between',
          status === 'true'
            ? 'bg-green-100 text-green-700 font-medium'
            : 'bg-slate-100 text-slate-600'
        )}>
          <span>True</span>
          {status === 'true' && <span>→</span>}
        </div>
        <div className={clsx(
          'text-xs px-2 py-1 rounded flex items-center justify-between',
          status === 'false'
            ? 'bg-red-100 text-red-700 font-medium'
            : 'bg-slate-100 text-slate-600'
        )}>
          <span>False</span>
          {status === 'false' && <span>→</span>}
        </div>
      </div>

      {/* Result indicator */}
      {result !== undefined && (
        <div className="px-3 py-2 border-t">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Result</span>
            <span className={clsx(
              'font-bold',
              result ? 'text-green-600' : 'text-red-600'
            )}>
              {result ? 'TRUE' : 'FALSE'}
            </span>
          </div>
        </div>
      )}

      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-amber-500 border-2 border-white"
      />

      {/* Output handles: true (top-right), false (bottom-right) */}
      <Handle
        type="source"
        position={Position.Right}
        id="true"
        style={{ top: '40%' }}
        className="w-3 h-3 bg-green-500 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="false"
        style={{ top: '70%' }}
        className="w-3 h-3 bg-red-500 border-2 border-white"
      />
    </div>
  );
}

export default memo(ConditionNode);
