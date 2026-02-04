import { useStore } from '../store';
import InstancePoolPanel from './InstancePoolPanel';
import MetricsDashboard from './MetricsDashboard';
import FailureTracker from './FailureTracker';
import FailureDetailPanel from './FailureDetailPanel';
import TaskQueuePanel from './TaskQueuePanel';
import EventStream from './EventStream';

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
  const selectedFailure = selectedFailureId
    ? failures.find((f) => f.id === selectedFailureId)
    : null;

  return (
    <div className="h-full w-full">
      <div className="h-full grid grid-cols-12 gap-4">
        {/* Left Column: Instance Pool + Metrics */}
        <div className="col-span-3 flex flex-col gap-4 min-h-0">
          <div className="flex-shrink-0">
            <InstancePoolPanel onSpawnInstance={onSpawnInstance} />
          </div>
          <div className="flex-1 min-h-0 overflow-auto">
            <MetricsDashboard />
          </div>
        </div>

        {/* Center Column: Failure Tracker + Detail Panel */}
        <div className="col-span-5 flex flex-col gap-4 min-h-0">
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
