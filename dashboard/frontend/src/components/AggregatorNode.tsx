import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Combine, Loader2, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';

interface AggregatorNodeProps {
  data: {
    label: string;
    status: 'idle' | 'waiting' | 'aggregating' | 'complete';
    inputs?: Array<{ source: string; received: boolean; content?: string }>;
    result?: string;
  };
}

function AggregatorNode({ data }: AggregatorNodeProps) {
  const { status, inputs = [], result } = data;
  const receivedCount = inputs.filter(i => i.received).length;

  return (
    <div className={clsx(
      'bg-white rounded-lg shadow-md border-2 w-[240px] overflow-hidden',
      status === 'waiting' && 'border-amber-400',
      status === 'aggregating' && 'border-blue-400',
      status === 'complete' && 'border-green-400',
      status === 'idle' && 'border-slate-300'
    )}>
      {/* Header */}
      <div className={clsx(
        'px-3 py-2 border-b flex items-center justify-between',
        status === 'aggregating' && 'bg-blue-50',
        status === 'complete' && 'bg-green-50',
        status === 'idle' && 'bg-slate-50'
      )}>
        <div className="flex items-center gap-2">
          <Combine className={clsx(
            'w-4 h-4',
            status === 'aggregating' && 'text-blue-600',
            status === 'complete' && 'text-green-600',
            status === 'idle' && 'text-slate-500'
          )} />
          <span className="font-semibold text-slate-700 text-sm">Aggregator</span>
        </div>
        {(status === 'waiting' || status === 'aggregating') && (
          <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
        )}
        {status === 'complete' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
      </div>

      {/* Input status */}
      {inputs.length > 0 && (
        <div className="px-3 py-2 border-b">
          <div className="text-xs text-slate-500 mb-1">
            Inputs ({receivedCount}/{inputs.length})
          </div>
          <div className="flex gap-1">
            {inputs.map((input, i) => (
              <div
                key={i}
                className={clsx(
                  'w-6 h-6 rounded flex items-center justify-center text-xs font-medium',
                  input.received
                    ? 'bg-green-100 text-green-700'
                    : 'bg-slate-100 text-slate-400'
                )}
              >
                {i + 1}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Result preview */}
      {result && (
        <div className="px-3 py-2">
          <div className="text-xs text-slate-500 mb-1">Aggregated Result</div>
          <div className="text-xs bg-green-50 text-slate-700 p-2 rounded border border-green-200 line-clamp-3">
            {result}
          </div>
        </div>
      )}

      {/* Input handles */}
      <Handle
        type="target"
        position={Position.Left}
        id="input-0"
        style={{ top: '30%' }}
        className="w-3 h-3 bg-blue-500 border-2 border-white"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="input-1"
        style={{ top: '50%' }}
        className="w-3 h-3 bg-purple-500 border-2 border-white"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="input-2"
        style={{ top: '70%' }}
        className="w-3 h-3 bg-orange-500 border-2 border-white"
      />

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-green-500 border-2 border-white"
      />
    </div>
  );
}

export default memo(AggregatorNode);
