import { AlertTriangle, RotateCcw, ArrowUpRight, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { useStore } from '../store';
import type { FailureState, FailureStatus } from '../types';
import { phaseOrder, getPhaseConfig, getPhaseIndex } from '../utils/taskConfig';

// Status configuration
const statusConfigs: Record<FailureStatus, { label: string; color: string; bgColor: string; dotColor: string }> = {
  pending: {
    label: 'Pending',
    color: 'text-slate-600',
    bgColor: 'bg-slate-100',
    dotColor: 'bg-slate-400',
  },
  processing: {
    label: 'Processing',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    dotColor: 'bg-blue-500',
  },
  fixed: {
    label: 'Fixed',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    dotColor: 'bg-green-500',
  },
  escalated: {
    label: 'Escalated',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    dotColor: 'bg-red-500',
  },
};

interface FailureRowProps {
  failure: FailureState;
  isSelected: boolean;
  onSelect: () => void;
  onRetry?: (failureId: string) => void;
  onEscalate?: (failureId: string) => void;
}

function PhaseProgressIndicator({ currentPhase }: { currentPhase: FailureState['phase'] }) {
  const currentIndex = getPhaseIndex(currentPhase);

  return (
    <div className="flex items-center gap-1">
      {phaseOrder.map((phase, index) => {
        const config = getPhaseConfig(phase);
        const Icon = config.icon;
        const isComplete = index < currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <div key={phase} className="flex items-center">
            <div
              className={clsx(
                'p-1 rounded transition-all',
                isComplete && 'bg-green-100',
                isCurrent && config.bgColor,
                !isComplete && !isCurrent && 'bg-slate-100'
              )}
              title={config.label}
            >
              <Icon
                className={clsx(
                  'w-3 h-3',
                  isComplete && 'text-green-600',
                  isCurrent && config.color,
                  !isComplete && !isCurrent && 'text-slate-300'
                )}
              />
            </div>
            {index < phaseOrder.length - 1 && (
              <div
                className={clsx(
                  'w-3 h-0.5 mx-0.5',
                  index < currentIndex ? 'bg-green-400' : 'bg-slate-200'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function FailureRow({ failure, isSelected, onSelect, onRetry, onEscalate }: FailureRowProps) {
  const statusConfig = statusConfigs[failure.status];

  return (
    <div
      onClick={onSelect}
      className={clsx(
        'px-4 py-3 cursor-pointer transition-all border-l-4',
        isSelected
          ? 'bg-blue-50 border-l-blue-500'
          : 'hover:bg-slate-50 border-l-transparent'
      )}
    >
      {/* Header Row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span
            className={clsx(
              'w-2 h-2 rounded-full flex-shrink-0',
              statusConfig.dotColor
            )}
          />
          <span className="font-mono text-xs text-slate-700 truncate">
            {failure.id.slice(0, 12)}
          </span>
          <span
            className={clsx(
              'px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0',
              statusConfig.bgColor,
              statusConfig.color
            )}
          >
            {statusConfig.label}
          </span>
        </div>
        <ChevronRight
          className={clsx(
            'w-4 h-4 text-slate-400 transition-transform flex-shrink-0',
            isSelected && 'rotate-90'
          )}
        />
      </div>

      {/* Test File */}
      <div className="text-xs text-slate-600 truncate mb-2" title={failure.test_file}>
        {failure.test_file}
      </div>

      {/* Phase Progress */}
      <div className="mb-2">
        <PhaseProgressIndicator currentPhase={failure.phase} />
      </div>

      {/* Error Preview */}
      <div className="text-[10px] text-slate-500 line-clamp-2 mb-2">
        {failure.error_message}
      </div>

      {/* Actions */}
      {(failure.status === 'processing' || failure.status === 'pending') && (
        <div className="flex items-center gap-2">
          {onRetry && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRetry(failure.id);
              }}
              className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-blue-600 hover:bg-blue-100 rounded transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Retry
            </button>
          )}
          {onEscalate && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEscalate(failure.id);
              }}
              className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-red-600 hover:bg-red-100 rounded transition-colors"
            >
              <ArrowUpRight className="w-3 h-3" />
              Escalate
            </button>
          )}
        </div>
      )}

      {/* Retry Counts */}
      {Object.keys(failure.retries).length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {Object.entries(failure.retries).map(([phase, count]) => (
            <span
              key={phase}
              className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-medium"
            >
              {phase}: {count} retries
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

interface FailureTrackerProps {
  onRetry?: (failureId: string) => void;
  onEscalate?: (failureId: string) => void;
  /** Optional: provide failures directly instead of reading from store */
  failures?: FailureState[];
  /** Optional: provide selectedFailureId directly instead of reading from store */
  selectedFailureId?: string | null;
  /** Optional: provide setSelectedFailureId directly instead of reading from store */
  onSelectFailure?: (id: string | null) => void;
}

export default function FailureTracker({
  onRetry,
  onEscalate,
  failures: failuresProp,
  selectedFailureId: selectedFailureIdProp,
  onSelectFailure,
}: FailureTrackerProps) {
  const storeFailures = useStore((s) => s.failures);
  const storeSelectedFailureId = useStore((s) => s.selectedFailureId);
  const storeSetSelectedFailureId = useStore((s) => s.setSelectedFailureId);

  const failures = failuresProp ?? storeFailures;
  const selectedFailureId = selectedFailureIdProp !== undefined ? selectedFailureIdProp : storeSelectedFailureId;
  const setSelectedFailureId = onSelectFailure ?? storeSetSelectedFailureId;

  // Group failures by status
  const processing = failures.filter((f) => f.status === 'processing');
  const pending = failures.filter((f) => f.status === 'pending');
  const fixed = failures.filter((f) => f.status === 'fixed');
  const escalated = failures.filter((f) => f.status === 'escalated');

  const counts = {
    total: failures.length,
    processing: processing.length,
    pending: pending.length,
    fixed: fixed.length,
    escalated: escalated.length,
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-slate-600" />
            <h3 className="font-semibold text-slate-800">Failure Tracker</h3>
          </div>
          <span className="text-xs text-slate-500">{counts.total} total</span>
        </div>

        {/* Status Summary */}
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            {counts.processing} processing
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            {counts.pending} pending
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            {counts.fixed} fixed
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            {counts.escalated} escalated
          </span>
        </div>
      </div>

      {/* Failure List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {failures.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No failures tracked</p>
            <p className="text-xs mt-1">Test failures will appear here</p>
          </div>
        ) : (
          <>
            {/* Processing first */}
            {processing.map((failure) => (
              <FailureRow
                key={failure.id}
                failure={failure}
                isSelected={selectedFailureId === failure.id}
                onSelect={() => setSelectedFailureId(failure.id === selectedFailureId ? null : failure.id)}
                onRetry={onRetry}
                onEscalate={onEscalate}
              />
            ))}
            {/* Then pending */}
            {pending.map((failure) => (
              <FailureRow
                key={failure.id}
                failure={failure}
                isSelected={selectedFailureId === failure.id}
                onSelect={() => setSelectedFailureId(failure.id === selectedFailureId ? null : failure.id)}
                onRetry={onRetry}
                onEscalate={onEscalate}
              />
            ))}
            {/* Then escalated */}
            {escalated.map((failure) => (
              <FailureRow
                key={failure.id}
                failure={failure}
                isSelected={selectedFailureId === failure.id}
                onSelect={() => setSelectedFailureId(failure.id === selectedFailureId ? null : failure.id)}
                onRetry={onRetry}
                onEscalate={onEscalate}
              />
            ))}
            {/* Fixed last */}
            {fixed.map((failure) => (
              <FailureRow
                key={failure.id}
                failure={failure}
                isSelected={selectedFailureId === failure.id}
                onSelect={() => setSelectedFailureId(failure.id === selectedFailureId ? null : failure.id)}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
