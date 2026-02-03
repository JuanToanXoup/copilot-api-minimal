import { X, FileText, RotateCcw, ArrowUpRight, CheckCircle2, AlertCircle } from 'lucide-react';
import clsx from 'clsx';
import type { FailureState, TaskHistoryEntry } from '../types';
import { getTaskTypeConfig, getTaskStatusConfig, phaseOrder, getPhaseConfig, getPhaseIndex } from '../utils/taskConfig';

// Status configuration
const statusConfigs = {
  pending: { label: 'Pending', color: 'text-slate-600', bgColor: 'bg-slate-100' },
  processing: { label: 'Processing', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  fixed: { label: 'Fixed', color: 'text-green-600', bgColor: 'bg-green-100' },
  escalated: { label: 'Escalated', color: 'text-red-600', bgColor: 'bg-red-100' },
};

interface TaskHistoryItemProps {
  entry: TaskHistoryEntry;
}

function TaskHistoryItem({ entry }: TaskHistoryItemProps) {
  const typeConfig = getTaskTypeConfig(entry.task_type);
  const statusConfig = getTaskStatusConfig(entry.status);
  const TypeIcon = typeConfig.icon;

  return (
    <div className="flex items-start gap-3 relative">
      {/* Timeline connector */}
      <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-slate-200" />

      {/* Icon */}
      <div
        className={clsx(
          'relative z-10 p-1.5 rounded-full border-2 bg-white',
          entry.status === 'completed' && 'border-green-400',
          entry.status === 'failed' && 'border-red-400',
          entry.status === 'assigned' && 'border-blue-400',
          entry.status === 'queued' && 'border-slate-300'
        )}
      >
        <TypeIcon className={clsx('w-3 h-3', typeConfig.color)} />
      </div>

      {/* Content */}
      <div className="flex-1 pb-4">
        <div className="flex items-center justify-between">
          <span className={clsx('text-xs font-medium', typeConfig.color)}>
            {typeConfig.label}
          </span>
          <span
            className={clsx(
              'px-1.5 py-0.5 rounded text-[10px] font-medium',
              statusConfig.bgColor,
              statusConfig.color
            )}
          >
            {statusConfig.label}
          </span>
        </div>

        <div className="text-[10px] text-slate-500 mt-1">
          Started: {new Date(entry.started_at).toLocaleTimeString()}
          {entry.completed_at && (
            <span className="ml-2">
              Completed: {new Date(entry.completed_at).toLocaleTimeString()}
            </span>
          )}
        </div>

        {entry.result && (
          <div className="mt-1.5 p-2 bg-green-50 rounded border border-green-200 text-[10px] text-green-700 line-clamp-2">
            {entry.result}
          </div>
        )}

        {entry.error && (
          <div className="mt-1.5 p-2 bg-red-50 rounded border border-red-200 text-[10px] text-red-700 line-clamp-2">
            {entry.error}
          </div>
        )}
      </div>
    </div>
  );
}

interface FailureDetailPanelProps {
  failure: FailureState;
  onClose: () => void;
  onRetry?: (failureId: string) => void;
  onEscalate?: (failureId: string) => void;
}

export default function FailureDetailPanel({
  failure,
  onClose,
  onRetry,
  onEscalate,
}: FailureDetailPanelProps) {
  const statusConfig = statusConfigs[failure.status];
  const currentPhaseIndex = getPhaseIndex(failure.phase);

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-slate-600" />
            <h3 className="font-semibold text-slate-800">Failure Details</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Status & ID */}
        <div className="px-4 py-3 border-b border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-sm text-slate-700">{failure.id}</span>
            <span
              className={clsx(
                'px-2 py-1 rounded text-xs font-medium',
                statusConfig.bgColor,
                statusConfig.color
              )}
            >
              {statusConfig.label}
            </span>
          </div>
          <div className="text-xs text-slate-500">
            Version: {failure.version} | Updated: {new Date(failure.updated_at).toLocaleString()}
          </div>
        </div>

        {/* Phase Progress */}
        <div className="px-4 py-3 border-b border-slate-200">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
            Phase Progress
          </div>
          <div className="flex items-center justify-between">
            {phaseOrder.map((phase, index) => {
              const config = getPhaseConfig(phase);
              const Icon = config.icon;
              const isComplete = index < currentPhaseIndex;
              const isCurrent = index === currentPhaseIndex;

              return (
                <div key={phase} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <div
                      className={clsx(
                        'p-2 rounded-full transition-all',
                        isComplete && 'bg-green-100',
                        isCurrent && config.bgColor,
                        !isComplete && !isCurrent && 'bg-slate-100'
                      )}
                    >
                      {isComplete ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      ) : (
                        <Icon
                          className={clsx(
                            'w-4 h-4',
                            isCurrent ? config.color : 'text-slate-300'
                          )}
                        />
                      )}
                    </div>
                    <span
                      className={clsx(
                        'text-[10px] mt-1 font-medium',
                        isComplete && 'text-green-600',
                        isCurrent && config.color,
                        !isComplete && !isCurrent && 'text-slate-300'
                      )}
                    >
                      {config.label}
                    </span>
                  </div>
                  {index < phaseOrder.length - 1 && (
                    <div
                      className={clsx(
                        'flex-1 h-0.5 mx-2',
                        index < currentPhaseIndex ? 'bg-green-400' : 'bg-slate-200'
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Test File */}
        <div className="px-4 py-3 border-b border-slate-200">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
            Test File
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <FileText className="w-4 h-4 text-slate-400" />
            <span className="font-mono truncate">{failure.test_file}</span>
          </div>
        </div>

        {/* Error Message */}
        <div className="px-4 py-3 border-b border-slate-200">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
            Error Message
          </div>
          <div className="p-2 bg-red-50 rounded border border-red-200 text-xs text-red-700 whitespace-pre-wrap">
            {failure.error_message}
          </div>
        </div>

        {/* Stack Trace (if available) */}
        {failure.stack_trace && (
          <div className="px-4 py-3 border-b border-slate-200">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
              Stack Trace
            </div>
            <div className="p-2 bg-slate-50 rounded border border-slate-200 text-[10px] text-slate-600 font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
              {failure.stack_trace}
            </div>
          </div>
        )}

        {/* Retry Counts */}
        {Object.keys(failure.retries).length > 0 && (
          <div className="px-4 py-3 border-b border-slate-200">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              Retry Counts
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(failure.retries).map(([phase, count]) => (
                <span
                  key={phase}
                  className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-medium"
                >
                  {phase}: {count}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Task History */}
        <div className="px-4 py-3">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
            Task History ({failure.task_history.length})
          </div>
          {failure.task_history.length === 0 ? (
            <div className="text-center py-4 text-slate-400 text-xs">
              No tasks executed yet
            </div>
          ) : (
            <div className="relative">
              {failure.task_history.map((entry, index) => (
                <TaskHistoryItem key={`${entry.task_id}-${index}`} entry={entry} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Actions Footer */}
      {(failure.status === 'processing' || failure.status === 'pending') && (
        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center gap-2">
          {onRetry && (
            <button
              onClick={() => onRetry(failure.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-100 rounded transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Retry
            </button>
          )}
          {onEscalate && (
            <button
              onClick={() => onEscalate(failure.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100 rounded transition-colors"
            >
              <ArrowUpRight className="w-4 h-4" />
              Escalate
            </button>
          )}
        </div>
      )}
    </div>
  );
}
