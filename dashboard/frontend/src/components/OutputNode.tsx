import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { FileOutput, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

interface ResultItem {
  role: string;
  response: string;
  timestamp: string;
  port?: number;
}

interface OutputNodeProps {
  data: {
    label: string;
    results: ResultItem[];
    status: 'idle' | 'complete' | 'error';
  };
}

// Decode HTML entities
function decodeHtml(html: string): string {
  const txt = document.createElement('textarea');
  txt.innerHTML = html;
  return txt.value;
}

function OutputNode({ data }: OutputNodeProps) {
  const { results, status } = data;
  const hasErrors = results.some(r => r.response.includes('error') || r.response.includes('cannot call'));

  return (
    <div className={clsx(
      'bg-white rounded-lg shadow-md border-2 w-[350px] overflow-hidden',
      status === 'complete' && !hasErrors && 'border-green-400',
      status === 'complete' && hasErrors && 'border-amber-400',
      status === 'idle' && 'border-slate-200'
    )}>
      {/* Header */}
      <div className={clsx(
        'px-3 py-2 border-b flex items-center justify-between',
        status === 'complete' && !hasErrors && 'bg-green-50',
        status === 'complete' && hasErrors && 'bg-amber-50',
        status === 'idle' && 'bg-slate-50'
      )}>
        <div className="flex items-center gap-2">
          <FileOutput className="w-4 h-4 text-slate-600" />
          <span className="font-semibold text-slate-700 text-sm">
            Results
          </span>
          {results.length > 0 && (
            <span className="text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">
              {results.length} step{results.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        {status === 'complete' && !hasErrors && (
          <CheckCircle2 className="w-4 h-4 text-green-500" />
        )}
        {status === 'complete' && hasErrors && (
          <AlertCircle className="w-4 h-4 text-amber-500" />
        )}
      </div>

      {/* Results */}
      <div className="max-h-[250px] overflow-y-auto">
        {results.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {results.map((result: ResultItem, i: number) => (
              <div key={i} className="px-3 py-2">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-600">
                      Step {i + 1}
                    </span>
                    {result.port && (
                      <span className="text-xs text-slate-400">
                        Port {result.port}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <Clock className="w-3 h-3" />
                    {new Date(result.timestamp).toLocaleTimeString()}
                  </div>
                </div>
                <div className={clsx(
                  'text-xs rounded p-2 whitespace-pre-wrap break-words',
                  result.response.includes('error') || result.response.includes('cannot')
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-slate-50 text-slate-700 border border-slate-200'
                )}>
                  {decodeHtml(result.response.slice(0, 300))}
                  {result.response.length > 300 && (
                    <span className="text-slate-400">... (truncated)</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-3 py-6 text-center text-slate-400 text-xs">
            Connect agents and run workflow to see results
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
