import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { GitBranch, Loader2, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';

interface RouterNodeProps {
  data: {
    label: string;
    status: 'idle' | 'routing' | 'complete';
    selectedRoute?: string;
    routes?: string[];
  };
}

function RouterNode({ data }: RouterNodeProps) {
  const { status, selectedRoute, routes = ['Agent A', 'Agent B', 'Agent C'] } = data;

  return (
    <div className={clsx(
      'bg-white rounded-lg shadow-md border-2 w-[200px] overflow-hidden',
      status === 'routing' && 'border-amber-400',
      status === 'complete' && 'border-green-400',
      status === 'idle' && 'border-slate-300'
    )}>
      {/* Header */}
      <div className={clsx(
        'px-3 py-2 border-b flex items-center justify-between',
        status === 'routing' && 'bg-amber-50',
        status === 'complete' && 'bg-green-50',
        status === 'idle' && 'bg-slate-50'
      )}>
        <div className="flex items-center gap-2">
          <GitBranch className={clsx(
            'w-4 h-4',
            status === 'routing' && 'text-amber-600',
            status === 'complete' && 'text-green-600',
            status === 'idle' && 'text-slate-500'
          )} />
          <span className="font-semibold text-slate-700 text-sm">Router</span>
        </div>
        {status === 'routing' && <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />}
        {status === 'complete' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
      </div>

      {/* Routes */}
      <div className="px-3 py-2 space-y-1">
        {routes.map((route, i) => (
          <div
            key={i}
            className={clsx(
              'text-xs px-2 py-1 rounded flex items-center justify-between',
              selectedRoute === route
                ? 'bg-green-100 text-green-700 font-medium'
                : 'bg-slate-100 text-slate-600'
            )}
          >
            <span>{route}</span>
            {selectedRoute === route && <span>→</span>}
          </div>
        ))}
      </div>

      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-amber-500 border-2 border-white"
      />

      {/* Output handles for each route */}
      <Handle
        type="source"
        position={Position.Right}
        id="route-0"
        style={{ top: '40%' }}
        className="w-3 h-3 bg-blue-500 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="route-1"
        style={{ top: '55%' }}
        className="w-3 h-3 bg-purple-500 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="route-2"
        style={{ top: '70%' }}
        className="w-3 h-3 bg-orange-500 border-2 border-white"
      />
    </div>
  );
}

export default memo(RouterNode);
