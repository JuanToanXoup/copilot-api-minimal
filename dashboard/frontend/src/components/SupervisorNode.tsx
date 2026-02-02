import { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Brain, Play, Loader2, CheckCircle2, ArrowRight } from 'lucide-react';
import clsx from 'clsx';

interface SupervisorNodeProps {
  data: {
    label: string;
    status: 'idle' | 'thinking' | 'routing' | 'complete';
    currentStep?: string;
    decision?: string;
    history?: Array<{
      step: number;
      action: string;
      agent?: string;
      result?: string;
    }>;
    onStart?: (prompt: string) => void;
  };
}

function SupervisorNode({ data }: SupervisorNodeProps) {
  const [prompt, setPrompt] = useState('');
  const { status, currentStep, decision, history = [] } = data;

  const handleStart = () => {
    if (prompt.trim() && data.onStart) {
      data.onStart(prompt);
    }
  };

  return (
    <div className={clsx(
      'bg-white rounded-lg shadow-lg border-2 w-[380px] overflow-hidden',
      status === 'thinking' && 'border-purple-400',
      status === 'routing' && 'border-blue-400',
      status === 'complete' && 'border-green-400',
      status === 'idle' && 'border-slate-300'
    )}>
      {/* Header */}
      <div className={clsx(
        'px-4 py-3 border-b flex items-center justify-between',
        status === 'idle' && 'bg-gradient-to-r from-purple-50 to-blue-50',
        status === 'thinking' && 'bg-purple-50',
        status === 'routing' && 'bg-blue-50',
        status === 'complete' && 'bg-green-50'
      )}>
        <div className="flex items-center gap-2">
          <Brain className={clsx(
            'w-5 h-5',
            status === 'thinking' && 'text-purple-600 animate-pulse',
            status === 'routing' && 'text-blue-600',
            status === 'complete' && 'text-green-600',
            status === 'idle' && 'text-purple-500'
          )} />
          <span className="font-semibold text-slate-700">Supervisor</span>
        </div>
        {status === 'thinking' && (
          <div className="flex items-center gap-1 text-purple-600 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Analyzing...
          </div>
        )}
        {status === 'routing' && (
          <div className="flex items-center gap-1 text-blue-600 text-sm">
            <ArrowRight className="w-4 h-4" />
            Routing...
          </div>
        )}
        {status === 'complete' && (
          <CheckCircle2 className="w-5 h-5 text-green-500" />
        )}
      </div>

      {/* Input Section - Only show when idle */}
      {status === 'idle' && (
        <div className="p-4 border-b">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter your task for the agent team..."
            className="w-full h-20 px-3 py-2 text-sm border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            onClick={handleStart}
            disabled={!prompt.trim()}
            className={clsx(
              'w-full mt-2 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all',
              prompt.trim()
                ? 'bg-purple-500 text-white hover:bg-purple-600'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            )}
          >
            <Play className="w-4 h-4" />
            Start Workflow
          </button>
        </div>
      )}

      {/* Current Decision */}
      {currentStep && (
        <div className="px-4 py-3 bg-slate-50 border-b">
          <div className="text-xs text-slate-500 mb-1">Current Action</div>
          <div className="text-sm font-medium text-slate-700">{currentStep}</div>
        </div>
      )}

      {/* Decision History */}
      {history.length > 0 && (
        <div className="px-4 py-3 max-h-[200px] overflow-y-auto">
          <div className="text-xs text-slate-500 mb-2">Decision History</div>
          <div className="space-y-2">
            {history.map((item, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className={clsx(
                  'w-5 h-5 rounded-full flex items-center justify-center text-white font-medium shrink-0',
                  item.action === 'route' && 'bg-blue-500',
                  item.action === 'revise' && 'bg-amber-500',
                  item.action === 'complete' && 'bg-green-500',
                  item.action === 'analyze' && 'bg-purple-500'
                )}>
                  {item.step}
                </span>
                <div className="flex-1">
                  <div className="font-medium text-slate-700">
                    {item.action === 'route' && `Routed to ${item.agent}`}
                    {item.action === 'revise' && `Sent back to ${item.agent} for revision`}
                    {item.action === 'complete' && 'Task completed'}
                    {item.action === 'analyze' && 'Analyzing task'}
                  </div>
                  {item.result && (
                    <div className="text-slate-500 mt-0.5 line-clamp-2">{item.result}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Final Decision */}
      {decision && status === 'complete' && (
        <div className="px-4 py-3 bg-green-50 border-t">
          <div className="text-xs text-green-600 mb-1">Final Output</div>
          <div className="text-sm text-slate-700">{decision}</div>
        </div>
      )}

      {/* Handles for connections */}
      <Handle
        type="target"
        position={Position.Top}
        id="input"
        className="w-3 h-3 bg-purple-500 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="to-coder"
        style={{ top: '30%' }}
        className="w-3 h-3 bg-blue-500 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="to-reviewer"
        style={{ top: '50%' }}
        className="w-3 h-3 bg-purple-500 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="to-tester"
        style={{ top: '70%' }}
        className="w-3 h-3 bg-orange-500 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="output"
        className="w-3 h-3 bg-green-500 border-2 border-white"
      />
    </div>
  );
}

export default memo(SupervisorNode);
