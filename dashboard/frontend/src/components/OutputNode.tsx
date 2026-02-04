import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { FileOutput, CheckCircle2, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

interface OutputNodeProps {
  data: {
    label: string;
    description?: string;
    results?: unknown[];
    status: 'idle' | 'complete' | 'error';
  };
  selected?: boolean;
}

function OutputNode({ data, selected }: OutputNodeProps) {
  const { label, description, results = [], status } = data;

  return (
    <div className={clsx(
      'bg-white rounded-lg shadow-md border-2 w-[270px] transition-all',
      status === 'complete' && 'border-green-400',
      status === 'error' && 'border-red-400',
      status === 'idle' && 'border-slate-200',
      selected && 'ring-2 ring-slate-500 ring-offset-2'
    )}>
      {/* Header */}
      <div className={clsx(
        'px-3 py-2 flex items-center gap-2',
        status === 'complete' && 'bg-green-50',
        status === 'error' && 'bg-red-50',
        status === 'idle' && 'bg-slate-50'
      )}>
        <FileOutput className="w-4 h-4 text-slate-600 flex-shrink-0" />
        <span className="font-medium text-sm text-slate-700 truncate flex-1">
          {label || 'Output'}
        </span>
        {status === 'complete' && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
        {status === 'error' && <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
      </div>

      {/* Info */}
      <div className="px-3 py-2 border-t border-slate-100">
        {description ? (
          <p className="text-xs text-slate-500 truncate">{description}</p>
        ) : results.length > 0 ? (
          <p className="text-xs text-green-600">{results.length} result(s)</p>
        ) : (
          <p className="text-xs text-slate-400 italic">Waiting for results</p>
        )}
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-slate-500 border-2 border-white"
      />
    </div>
  );
}

export default memo(OutputNode);
