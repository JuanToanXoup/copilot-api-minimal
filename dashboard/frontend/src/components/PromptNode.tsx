import { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Send, Loader2 } from 'lucide-react';
import clsx from 'clsx';

interface PromptNodeProps {
  data: {
    label: string;
    prompt: string;
    status: 'idle' | 'running' | 'success' | 'error';
    onSubmit: (prompt: string) => void;
  };
}

function PromptNode({ data }: PromptNodeProps) {
  const [input, setInput] = useState(data.prompt || '');

  const handleSubmit = () => {
    if (input.trim() && data.status !== 'running') {
      data.onSubmit(input);
    }
  };

  return (
    <div className={clsx(
      'bg-white rounded-xl shadow-lg border-2 p-4 min-w-[320px]',
      data.status === 'running' && 'border-blue-400',
      data.status === 'success' && 'border-green-400',
      data.status === 'error' && 'border-red-400',
      data.status === 'idle' && 'border-slate-200'
    )}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-500" />
        <span className="font-semibold text-slate-700">Start Workflow</span>
      </div>

      <div className="space-y-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter your prompt..."
          className="w-full h-24 px-3 py-2 text-sm border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={data.status === 'running'}
        />

        <button
          onClick={handleSubmit}
          disabled={data.status === 'running' || !input.trim()}
          className={clsx(
            'w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all',
            data.status === 'running'
              ? 'bg-blue-100 text-blue-600 cursor-wait'
              : 'bg-blue-500 text-white hover:bg-blue-600 active:scale-[0.98]',
            !input.trim() && 'opacity-50 cursor-not-allowed'
          )}
        >
          {data.status === 'running' ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Run Workflow
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

export default memo(PromptNode);
