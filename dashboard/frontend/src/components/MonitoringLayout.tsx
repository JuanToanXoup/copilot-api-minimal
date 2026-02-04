import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useStore } from '../store';
import InstancePoolPanel from './InstancePoolPanel';
import MetricsDashboard from './MetricsDashboard';
import FailureTracker from './FailureTracker';
import FailureDetailPanel from './FailureDetailPanel';
import TaskQueuePanel from './TaskQueuePanel';
import EventStream from './EventStream';
import PipelineSelector from './PipelineSelector';
import FailureSubmitPanel from './FailureSubmitPanel';

interface MonitoringLayoutProps {
  onSpawnInstance?: () => void;
  onRetryFailure?: (failureId: string) => void;
  onEscalateFailure?: (failureId: string) => void;
}

export default function MonitoringLayout({
  onSpawnInstance,
  onRetryFailure,
  onEscalateFailure,
}: MonitoringLayoutProps) {
  const { failures, selectedFailureId, setSelectedFailureId } = useStore();
  const [showSubmitPanel, setShowSubmitPanel] = useState(false);
  const selectedFailure = selectedFailureId
    ? failures.find((f) => f.id === selectedFailureId)
    : null;

  return (
    <div className="h-full w-full">
      <div className="h-full grid grid-cols-12 gap-4">
        {/* Left Column: Pipeline Selector + Instance Pool + Metrics */}
        <div className="col-span-3 flex flex-col gap-4 min-h-0">
          <div className="flex-shrink-0">
            <PipelineSelector />
          </div>
          <div className="flex-shrink-0">
            <InstancePoolPanel onSpawnInstance={onSpawnInstance} />
          </div>
          <div className="flex-1 min-h-0 overflow-auto">
            <MetricsDashboard />
          </div>
        </div>

        {/* Center Column: Failure Tracker + Detail Panel */}
        <div className="col-span-5 flex flex-col gap-4 min-h-0">
          {/* Submit Failure Button */}
          {!showSubmitPanel && (
            <div className="flex-shrink-0">
              <button
                onClick={() => setShowSubmitPanel(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Submit Test Failure
              </button>
            </div>
          )}

          {/* Submit Panel (when open) */}
          {showSubmitPanel && (
            <div className="flex-shrink-0">
              <FailureSubmitPanel onClose={() => setShowSubmitPanel(false)} />
            </div>
          )}

          {selectedFailure ? (
            <>
              {/* Failure Tracker (collapsed when detail shown) */}
              <div className="flex-shrink-0 max-h-[40%] overflow-hidden">
                <FailureTracker
                  onRetry={onRetryFailure}
                  onEscalate={onEscalateFailure}
                />
              </div>
              {/* Failure Detail Panel */}
              <div className="flex-1 min-h-0">
                <FailureDetailPanel
                  failure={selectedFailure}
                  onClose={() => setSelectedFailureId(null)}
                  onRetry={onRetryFailure}
                  onEscalate={onEscalateFailure}
                />
              </div>
            </>
          ) : (
            /* Full Failure Tracker when no detail selected */
            <div className="flex-1 min-h-0">
              <FailureTracker
                onRetry={onRetryFailure}
                onEscalate={onEscalateFailure}
              />
            </div>
          )}
        </div>

        {/* Right Column: Task Queues + Event Stream */}
        <div className="col-span-4 flex flex-col gap-4 min-h-0">
          <div className="flex-1 min-h-0 max-h-[55%]">
            <TaskQueuePanel />
          </div>
          <div className="flex-1 min-h-0">
            <EventStream />
          </div>
        </div>
      </div>
    </div>
  );
}
