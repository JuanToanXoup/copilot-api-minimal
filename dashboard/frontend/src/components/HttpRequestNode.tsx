import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Globe, Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface HttpRequestNodeProps {
  data: {
    label: string;
    status: 'idle' | 'pending' | 'success' | 'error';
    method: HttpMethod;
    url: string;
    headers?: Record<string, string>;
    body?: string;
    response?: {
      status: number;
      statusText: string;
      data: unknown;
    };
    error?: string;
  };
}

const methodColors: Record<HttpMethod, string> = {
  GET: 'bg-green-100 text-green-700',
  POST: 'bg-blue-100 text-blue-700',
  PUT: 'bg-amber-100 text-amber-700',
  PATCH: 'bg-purple-100 text-purple-700',
  DELETE: 'bg-red-100 text-red-700',
};

function HttpRequestNode({ data }: HttpRequestNodeProps) {
  const {
    label,
    status,
    method = 'GET',
    url = '',
    response,
    error,
  } = data;

  const displayUrl = url.length > 35 ? url.substring(0, 35) + '...' : url;

  return (
    <div className={clsx(
      'bg-white rounded-lg shadow-md border-2 w-[260px] overflow-hidden',
      status === 'pending' && 'border-blue-400',
      status === 'success' && 'border-green-400',
      status === 'error' && 'border-red-400',
      status === 'idle' && 'border-slate-300'
    )}>
      {/* Header */}
      <div className={clsx(
        'px-3 py-2 border-b flex items-center justify-between',
        status === 'pending' && 'bg-blue-50',
        status === 'success' && 'bg-green-50',
        status === 'error' && 'bg-red-50',
        status === 'idle' && 'bg-slate-50'
      )}>
        <div className="flex items-center gap-2">
          <Globe className={clsx(
            'w-4 h-4',
            status === 'pending' && 'text-blue-600',
            status === 'success' && 'text-green-600',
            status === 'error' && 'text-red-600',
            status === 'idle' && 'text-slate-500'
          )} />
          <span className="font-semibold text-slate-700 text-sm">{label || 'HTTP Request'}</span>
        </div>
        {status === 'pending' && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
        {status === 'success' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
        {status === 'error' && <XCircle className="w-4 h-4 text-red-500" />}
      </div>

      {/* Method & URL */}
      <div className="px-3 py-2 border-b">
        <div className="flex items-center gap-2">
          <span className={clsx(
            'text-xs font-bold px-2 py-0.5 rounded',
            methodColors[method]
          )}>
            {method}
          </span>
          <span className="text-xs text-slate-600 font-mono truncate" title={url}>
            {displayUrl || 'No URL set'}
          </span>
        </div>
      </div>

      {/* Response Status */}
      {response && (
        <div className="px-3 py-2 border-b">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Response</span>
            <span className={clsx(
              'text-xs font-mono font-bold px-2 py-0.5 rounded',
              response.status >= 200 && response.status < 300 && 'bg-green-100 text-green-700',
              response.status >= 300 && response.status < 400 && 'bg-amber-100 text-amber-700',
              response.status >= 400 && 'bg-red-100 text-red-700'
            )}>
              {response.status} {response.statusText}
            </span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-3 py-2 border-b bg-red-50">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-3 h-3 text-red-500 mt-0.5 flex-shrink-0" />
            <span className="text-xs text-red-600 break-all">{error}</span>
          </div>
        </div>
      )}

      {/* Response Preview */}
      {response?.data && (
        <div className="px-3 py-2">
          <div className="text-xs text-slate-500 mb-1">Response Body</div>
          <div className="text-xs font-mono bg-slate-100 px-2 py-1.5 rounded text-slate-700 max-h-16 overflow-auto">
            {typeof response.data === 'string'
              ? response.data.substring(0, 100) + (response.data.length > 100 ? '...' : '')
              : JSON.stringify(response.data, null, 2).substring(0, 100) + '...'}
          </div>
        </div>
      )}

      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-blue-500 border-2 border-white"
      />

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-blue-500 border-2 border-white"
      />
    </div>
  );
}

export default memo(HttpRequestNode);
