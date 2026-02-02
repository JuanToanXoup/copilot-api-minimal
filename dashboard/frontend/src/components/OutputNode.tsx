import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { FileOutput, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';

interface ResultItem {
  role: string;
  response: string;
  timestamp: string;
}

interface OutputNodeProps {
  data: {
    label: string;
    results: ResultItem[];
    status: 'idle' | 'complete';
  };
}

function OutputNode({ data }: OutputNodeProps) {
  const { results, status } = data;

  return (
    <div className={clsx(
      'bg-white rounded-xl shadow-lg border-2 min-w-[300px] max-w-[400px] overflow-hidden',
      status === 'complete' ? 'border-green-400' : 'border-slate-200'
    )}>
      {/* Header */}
      <div className={clsx(
        'px-4 py-3 border-b flex items-center justify-between',
        status === 'complete' ? 'bg-green-50' : 'bg-slate-50'
      )}>
        <div className="flex items-center gap-2">
          <FileOutput className={clsx(
            'w-5 h-5',
            status === 'complete' ? 'text-green-600' : 'text-slate-600'
          )} />
          <span className={clsx(
            'font-semibold',
            status === 'complete' ? 'text-green-700' : 'text-slate-700'
          )}>
            Workflow Output
          </span>
        </div>
        {status === 'complete' && (
          <CheckCircle2 className="w-5 h-5 text-green-500" />
        )}
      </div>

      {/* Results */}
      <div className="max-h-[300px] overflow-y-auto">
        {results.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {results.map((result: ResultItem, i: number) => (
              <div key={i} className="px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-700 capitalize">
                    {result.role}
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(result.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-sm text-slate-600 font-mono bg-slate-50 rounded p-2 whitespace-pre-wrap">
                  {result.response.slice(0, 500)}
                  {result.response.length > 500 && '...'}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-8 text-center text-slate-400 text-sm">
            Waiting for workflow results...
          </div>
        )}
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-green-500 border-2 border-white"
      />
    </div>
  );
}

export default memo(OutputNode);
