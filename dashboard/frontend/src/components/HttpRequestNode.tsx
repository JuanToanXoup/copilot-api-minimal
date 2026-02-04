import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Globe, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import clsx from 'clsx';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface HttpRequestNodeProps {
  data: {
    label: string;
    description?: string;
    status: 'idle' | 'pending' | 'success' | 'error';
    method: HttpMethod;
    url: string;
    response?: {
      status: number;
      statusText: string;
      data: unknown;
    };
  };
  selected?: boolean;
}

const methodColors: Record<HttpMethod, string> = {
  GET: 'bg-green-100 text-green-700',
  POST: 'bg-blue-100 text-blue-700',
  PUT: 'bg-amber-100 text-amber-700',
  PATCH: 'bg-purple-100 text-purple-700',
  DELETE: 'bg-red-100 text-red-700',
};

function HttpRequestNode({ data, selected }: HttpRequestNodeProps) {
  const { label, description, status, method = 'GET', url = '' } = data;

  const displayUrl = url.length > 25 ? url.substring(0, 25) + '...' : url;

  return (
    <div className={clsx(
      'bg-white rounded-lg shadow-md border-2 w-[200px] transition-all',
      status === 'pending' && 'border-blue-400',
      status === 'success' && 'border-green-400',
      status === 'error' && 'border-red-400',
      status === 'idle' && 'border-cyan-200',
      selected && 'ring-2 ring-cyan-500 ring-offset-2'
    )}>
      {/* Header */}
      <div className={clsx(
        'px-3 py-2 flex items-center gap-2',
        status === 'pending' && 'bg-blue-50',
        status === 'success' && 'bg-green-50',
        status === 'error' && 'bg-red-50',
        status === 'idle' && 'bg-cyan-50'
      )}>
        <Globe className="w-4 h-4 text-cyan-600 flex-shrink-0" />
        <span className="font-medium text-sm text-slate-700 truncate flex-1">
          {label || 'HTTP Request'}
        </span>
        {status === 'pending' && <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />}
        {status === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
        {status === 'error' && <XCircle className="w-3.5 h-3.5 text-red-500" />}
      </div>

      {/* Info */}
      <div className="px-3 py-2 border-t border-slate-100 space-y-1">
        {description ? (
          <p className="text-xs text-slate-500 truncate">{description}</p>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              <span className={clsx('text-[10px] font-bold px-1.5 py-0.5 rounded', methodColors[method])}>
                {method}
              </span>
              <span className="text-xs text-slate-500 font-mono truncate">
                {displayUrl || 'No URL'}
              </span>
            </div>
          </>
        )}
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-cyan-500 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-cyan-500 border-2 border-white"
      />
    </div>
  );
}

export default memo(HttpRequestNode);
