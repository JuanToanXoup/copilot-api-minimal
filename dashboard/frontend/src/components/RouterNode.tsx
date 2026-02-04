import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Split, Loader2, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';

interface RouterNodeProps {
  data: {
    label: string;
    description?: string;
    status: 'idle' | 'routing' | 'complete';
    selectedRoute?: string;
    routes?: string[];
  };
  selected?: boolean;
}

function RouterNode({ data, selected }: RouterNodeProps) {
  const { label, description, status, routes = ['Route 1', 'Route 2'] } = data;

  return (
    <div className={clsx(
      'bg-white rounded-lg shadow-md border-2 w-[270px] transition-all',
      status === 'routing' && 'border-purple-400',
      status === 'complete' && 'border-green-400',
      status === 'idle' && 'border-purple-200',
      selected && 'ring-2 ring-purple-500 ring-offset-2'
    )}>
      {/* Header */}
      <div className={clsx(
        'px-3 py-2 flex items-center gap-2',
        status === 'routing' && 'bg-purple-50',
        status === 'complete' && 'bg-green-50',
        status === 'idle' && 'bg-purple-50'
      )}>
        <Split className="w-4 h-4 text-purple-600 flex-shrink-0" />
        <span className="font-medium text-sm text-slate-700 truncate flex-1">
          {label || 'Router'}
        </span>
        {status === 'routing' && <Loader2 className="w-3.5 h-3.5 text-purple-500 animate-spin" />}
        {status === 'complete' && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
      </div>

      {/* Info */}
      <div className="px-3 py-2 border-t border-slate-100">
        {description ? (
          <p className="text-xs text-slate-500 truncate">{description}</p>
        ) : (
          <p className="text-xs text-slate-400">{routes.length} routes</p>
        )}
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-purple-500 border-2 border-white"
      />
      {routes.map((_, i) => (
        <Handle
          key={i}
          type="source"
          position={Position.Right}
          id={`route-${i}`}
          style={{ top: `${30 + (i * 25)}%` }}
          className="w-3 h-3 bg-purple-500 border-2 border-white"
        />
      ))}
    </div>
  );
}

export default memo(RouterNode);
