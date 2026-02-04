import { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Play, Loader2 } from 'lucide-react';
import clsx from 'clsx';

interface WorkflowStartNodeProps {
  data: {
    label: string;
    description?: string;
    status?: 'idle' | 'running' | 'complete';
    onStart?: (input: string) => void;
  };
  selected?: boolean;
}

function WorkflowStartNode({ data, selected }: WorkflowStartNodeProps) {
  const [input, setInput] = useState('');
  const { label, description, status = 'idle', onStart } = data;

  const handleStart = () => {
    if (input.trim() && onStart && status !== 'running') {
      onStart(input);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.metaKey) {
      handleStart();
    }
  };

  return (
    <div
      className={clsx(
        'bg-white rounded-lg shadow-md border-2 w-[280px] transition-all',
        status === 'running' && 'border-blue-400',
        status === 'complete' && 'border-green-400',
        status === 'idle' && 'border-blue-200',
        selected && 'ring-2 ring-blue-500 ring-offset-2'
      )}
    >
      {/* Header */}
      <div className={clsx(
        'px-3 py-2 flex items-center gap-2',
        status === 'running' && 'bg-blue-50',
        status === 'complete' && 'bg-green-50',
        status === 'idle' && 'bg-blue-50'
      )}>
        <Play className="w-4 h-4 text-blue-600 flex-shrink-0" />
        <span className="font-medium text-sm text-slate-700 truncate flex-1">
          {label || 'Start'}
        </span>
        {status === 'running' && <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />}
      </div>

      {/* Description */}
      {description && (
        <div className="px-3 py-1.5 border-t border-slate-100">
          <p className="text-xs text-slate-500">{description}</p>
        </div>
      )}

      {/* Input area */}
      <div className="px-3 py-2 border-t border-slate-100 space-y-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter workflow input..."
          className="w-full h-20 px-2 py-1.5 text-xs border border-slate-200 rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 nodrag nowheel"
          disabled={status === 'running'}
        />

        <button
          onClick={handleStart}
          disabled={status === 'running' || !input.trim()}
          className={clsx(
            'w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all',
            status === 'running'
              ? 'bg-blue-100 text-blue-600 cursor-wait'
              : 'bg-blue-500 text-white hover:bg-blue-600',
            !input.trim() && 'opacity-50 cursor-not-allowed'
          )}
        >
          {status === 'running' ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="w-3 h-3" />
              Run
            </>
          )}
        </button>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-blue-500 border-2 border-white"
      />
    </div>
  );
}

export default memo(WorkflowStartNode);
