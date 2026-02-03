import { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Play, Loader2 } from 'lucide-react';
import clsx from 'clsx';

interface WorkflowStartNodeProps {
  data: {
    label: string;
    status?: 'idle' | 'running' | 'complete';
    onStart?: (input: string) => void;
  };
  selected?: boolean;
}

function WorkflowStartNode({ data, selected }: WorkflowStartNodeProps) {
  const [input, setInput] = useState('');
  const { status = 'idle', onStart } = data;

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
        'bg-white rounded-xl shadow-lg border-2 p-4 min-w-[320px]',
        status === 'running' && 'border-blue-400 bg-blue-50',
        status === 'complete' && 'border-green-400 bg-green-50',
        status === 'idle' && 'border-slate-200',
        selected && 'ring-2 ring-green-500 ring-offset-2'
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-3 h-3 rounded-full bg-gradient-to-r from-green-500 to-emerald-500" />
        <span className="font-semibold text-slate-700">{data.label || 'Workflow Input'}</span>
      </div>

      <div className="space-y-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter workflow input...

You can use this to provide:
- Test failure data
- Code to review
- Any structured or unstructured input

Variables like {{input}} in downstream blocks will receive this value."
          className="w-full h-32 px-3 py-2 text-sm border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent nodrag nowheel"
          disabled={status === 'running'}
        />

        <button
          onClick={handleStart}
          disabled={status === 'running' || !input.trim()}
          className={clsx(
            'w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all',
            status === 'running'
              ? 'bg-blue-100 text-blue-600 cursor-wait'
              : 'bg-green-500 text-white hover:bg-green-600 active:scale-[0.98]',
            !input.trim() && 'opacity-50 cursor-not-allowed'
          )}
        >
          {status === 'running' ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Running Workflow...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Run Workflow
              <span className="text-xs opacity-75 ml-1">(Cmd+Enter)</span>
            </>
          )}
        </button>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-green-500 border-2 border-white"
      />
    </div>
  );
}

export default memo(WorkflowStartNode);
