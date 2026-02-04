import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Layers, Loader2, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';

interface AggregatorNodeProps {
  data: {
    label: string;
    description?: string;
    status: 'idle' | 'waiting' | 'aggregating' | 'complete';
    mode?: 'all' | 'first' | 'merge';
  };
  selected?: boolean;
}

function AggregatorNode({ data, selected }: AggregatorNodeProps) {
  const { label, description, status, mode = 'all' } = data;

  return (
    <div className={clsx(
      'bg-white rounded-lg shadow-md border-2 w-[270px] transition-all',
      (status === 'waiting' || status === 'aggregating') && 'border-teal-400',
      status === 'complete' && 'border-green-400',
      status === 'idle' && 'border-teal-200',
      selected && 'ring-2 ring-teal-500 ring-offset-2'
    )}>
      {/* Header */}
      <div className={clsx(
        'px-3 py-2 flex items-center gap-2',
        (status === 'waiting' || status === 'aggregating') && 'bg-teal-50',
        status === 'complete' && 'bg-green-50',
        status === 'idle' && 'bg-teal-50'
      )}>
        <Layers className="w-4 h-4 text-teal-600 flex-shrink-0" />
        <span className="font-medium text-sm text-slate-700 truncate flex-1">
          {label || 'Aggregator'}
        </span>
        {(status === 'waiting' || status === 'aggregating') && (
          <Loader2 className="w-3.5 h-3.5 text-teal-500 animate-spin" />
        )}
        {status === 'complete' && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
      </div>

      {/* Info */}
      <div className="px-3 py-2 border-t border-slate-100">
        {description ? (
          <p className="text-xs text-slate-500 truncate">{description}</p>
        ) : (
          <p className="text-xs text-slate-400">Mode: {mode}</p>
        )}
      </div>

      {/* Multiple input handles */}
      <Handle
        type="target"
        position={Position.Left}
        id="input-0"
        style={{ top: '30%' }}
        className="w-3 h-3 bg-teal-500 border-2 border-white"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="input-1"
        style={{ top: '50%' }}
        className="w-3 h-3 bg-teal-500 border-2 border-white"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="input-2"
        style={{ top: '70%' }}
        className="w-3 h-3 bg-teal-500 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-teal-500 border-2 border-white"
      />
    </div>
  );
}

export default memo(AggregatorNode);
