import { useState } from 'react';
import { Plus, FlaskConical } from 'lucide-react';
import { useStore } from '../store';
import InstancePoolPanel from './InstancePoolPanel';
import MetricsDashboard from './MetricsDashboard';
import FailureTracker from './FailureTracker';
import FailureDetailPanel from './FailureDetailPanel';
import TaskQueuePanel from './TaskQueuePanel';
import EventStream from './EventStream';
import PipelineSelector from './PipelineSelector';
import FailureSubmitPanel from './FailureSubmitPanel';

interface MockMonitoringLayoutProps {
  onSpawnInstance?: () => void;
  onRetryFailure?: (failureId: string) => void;
  onEscalateFailure?: (failureId: string) => void;
}

export default function MockMonitoringLayout({
  onSpawnInstance,
  onRetryFailure,
  onEscalateFailure,
}: MockMonitoringLayoutProps) {
  // Get mock data from store
  const {
    mockFailures,
    mockSelectedFailureId,
    setMockSelectedFailureId,
    mockInstances,
    mockTasks,
    mockEvents,
    mockEventsPaused,
    setMockEventsPaused,
    clearMockEvents,
    mockPromptMetrics,
  } = useStore();

  const [showSubmitPanel, setShowSubmitPanel] = useState(false);

  const selectedFailure = mockSelectedFailureId
    ? mockFailures.find((f) => f.id === mockSelectedFailureId)
    : null;

  return (
    <div className="h-full w-full">
      {/* Mock Data Banner */}
      <div className="mb-4 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
        <FlaskConical className="w-4 h-4 text-amber-600" />
        <span className="text-sm text-amber-800 font-medium">
          Mock Data Mode
        </span>
        <span className="text-xs text-amber-600">
          - This tab displays simulated data for testing and comparison
        </span>
      </div>

      <div className="h-[calc(100%-3.5rem)] grid grid-cols-12 gap-4">
        {/* Left Column: Pipeline Selector + Instance Pool + Metrics */}
        <div className="col-span-3 flex flex-col gap-4 min-h-0">
          <div className="flex-shrink-0">
            <PipelineSelector />
          </div>
          <div className="flex-shrink-0">
            <InstancePoolPanel
              onSpawnInstance={onSpawnInstance}
              instances={mockInstances}
            />
          </div>
          <div className="flex-1 min-h-0 overflow-auto">
            <MetricsDashboard
              failures={mockFailures}
              instances={mockInstances}
              promptMetrics={mockPromptMetrics}
              events={mockEvents}
            />
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
                  failures={mockFailures}
                  selectedFailureId={mockSelectedFailureId}
                  onSelectFailure={setMockSelectedFailureId}
                />
              </div>
              {/* Failure Detail Panel */}
              <div className="flex-1 min-h-0">
                <FailureDetailPanel
                  failure={selectedFailure}
                  onClose={() => setMockSelectedFailureId(null)}
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
                failures={mockFailures}
                selectedFailureId={mockSelectedFailureId}
                onSelectFailure={setMockSelectedFailureId}
              />
            </div>
          )}
        </div>

        {/* Right Column: Task Queues + Event Stream */}
        <div className="col-span-4 flex flex-col gap-4 min-h-0">
          <div className="flex-1 min-h-0 max-h-[55%]">
            <TaskQueuePanel tasks={mockTasks} />
          </div>
          <div className="flex-1 min-h-0">
            <EventStream
              events={mockEvents}
              eventsPaused={mockEventsPaused}
              onSetEventsPaused={setMockEventsPaused}
              onClearEvents={clearMockEvents}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
