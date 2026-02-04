import { useState, useEffect, useCallback } from 'react';
import { Workflow, Check, ChevronDown, Play, AlertCircle, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { useStore } from '../store';

interface FlowSummary {
  name: string;
  description: string;
  nodeCount: number;
  edgeCount: number;
  folder: string | null;
  updatedAt: string | null;
}

interface ActiveWorkflow {
  active: boolean;
  workflow_id: string | null;
  workflow_name: string | null;
}

export default function PipelineSelector() {
  const { activeProjectPath, addToast } = useStore();
  const [flows, setFlows] = useState<FlowSummary[]>([]);
  const [activeWorkflow, setActiveWorkflow] = useState<ActiveWorkflow | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isActivating, setIsActivating] = useState(false);

  // Fetch available workflows
  const fetchFlows = useCallback(async () => {
    try {
      const params = activeProjectPath ? `?project_path=${encodeURIComponent(activeProjectPath)}` : '';
      const response = await fetch(`/api/flows${params}`);
      const data = await response.json();
      if (Array.isArray(data)) {
        setFlows(data);
      }
    } catch (error) {
      console.error('Failed to fetch flows:', error);
    }
  }, [activeProjectPath]);

  // Fetch active workflow
  const fetchActiveWorkflow = useCallback(async () => {
    try {
      const response = await fetch('/api/failures/workflow/active');
      const data = await response.json();
      setActiveWorkflow(data);
    } catch (error) {
      console.error('Failed to fetch active workflow:', error);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    setIsLoading(true);
    Promise.all([fetchFlows(), fetchActiveWorkflow()]).finally(() => {
      setIsLoading(false);
    });
  }, [fetchFlows, fetchActiveWorkflow]);

  // Activate a workflow
  const activateWorkflow = async (workflowId: string) => {
    setIsActivating(true);
    try {
      const response = await fetch('/api/failures/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflow_id: workflowId }),
      });
      const data = await response.json();

      if (data.error) {
        addToast({
          type: 'error',
          title: 'Activation Failed',
          message: data.error,
        });
      } else {
        setActiveWorkflow({
          active: true,
          workflow_id: workflowId,
          workflow_name: data.workflow_name || workflowId,
        });
        addToast({
          type: 'success',
          title: 'Pipeline Activated',
          message: `"${data.workflow_name || workflowId}" is now the active pipeline.`,
          duration: 3000,
        });
        setIsOpen(false);
      }
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Activation Failed',
        message: 'Failed to activate workflow. Check backend connection.',
      });
    } finally {
      setIsActivating(false);
    }
  };

  // Group flows by folder
  const groupedFlows = flows.reduce<Record<string, FlowSummary[]>>((acc, flow) => {
    const folder = flow.folder || 'Workflows';
    if (!acc[folder]) {
      acc[folder] = [];
    }
    acc[folder].push(flow);
    return acc;
  }, {});

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-2">
          <Workflow className="w-4 h-4 text-slate-600" />
          <h3 className="font-semibold text-slate-800">Active Pipeline</h3>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Select a workflow to use for processing failures
        </p>
      </div>

      {/* Current Selection */}
      <div className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-4 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : (
          <>
            {/* Active Workflow Display */}
            <div
              onClick={() => setIsOpen(!isOpen)}
              className={clsx(
                'flex items-center justify-between p-3 rounded-lg border-2 cursor-pointer transition-all',
                activeWorkflow?.active
                  ? 'border-green-200 bg-green-50 hover:border-green-300'
                  : 'border-amber-200 bg-amber-50 hover:border-amber-300'
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                {activeWorkflow?.active ? (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                    <Play className="w-4 h-4 text-green-600" />
                  </div>
                ) : (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                  </div>
                )}
                <div className="min-w-0">
                  {activeWorkflow?.active ? (
                    <>
                      <div className="text-sm font-medium text-green-800 truncate">
                        {activeWorkflow.workflow_name || activeWorkflow.workflow_id}
                      </div>
                      <div className="text-xs text-green-600">Active</div>
                    </>
                  ) : (
                    <>
                      <div className="text-sm font-medium text-amber-800">
                        No Pipeline Selected
                      </div>
                      <div className="text-xs text-amber-600">
                        Click to select a workflow
                      </div>
                    </>
                  )}
                </div>
              </div>
              <ChevronDown
                className={clsx(
                  'w-5 h-5 text-slate-400 transition-transform',
                  isOpen && 'rotate-180'
                )}
              />
            </div>

            {/* Dropdown */}
            {isOpen && (
              <div className="mt-2 border border-slate-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                {flows.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 text-sm">
                    <Workflow className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No workflows saved</p>
                    <p className="text-xs mt-1">
                      Create a workflow in the Workflow tab first
                    </p>
                  </div>
                ) : (
                  Object.entries(groupedFlows).map(([folder, folderFlows]) => (
                    <div key={folder}>
                      {/* Folder Header */}
                      {Object.keys(groupedFlows).length > 1 && (
                        <div className="px-3 py-1.5 bg-slate-100 text-xs font-medium text-slate-500 uppercase tracking-wide">
                          {folder}
                        </div>
                      )}
                      {/* Flows in folder */}
                      {folderFlows.map((flow) => {
                        const isActive = activeWorkflow?.workflow_id === flow.name;
                        return (
                          <div
                            key={`${folder}/${flow.name}`}
                            onClick={() => !isActivating && activateWorkflow(flow.name)}
                            className={clsx(
                              'flex items-center justify-between px-3 py-2.5 cursor-pointer transition-colors',
                              isActive
                                ? 'bg-green-50'
                                : 'hover:bg-slate-50',
                              isActivating && 'opacity-50 pointer-events-none'
                            )}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span
                                  className={clsx(
                                    'text-sm font-medium truncate',
                                    isActive ? 'text-green-700' : 'text-slate-700'
                                  )}
                                >
                                  {flow.name}
                                </span>
                                {isActive && (
                                  <span className="flex-shrink-0 px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] font-medium rounded">
                                    Active
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500 truncate mt-0.5">
                                {flow.description || `${flow.nodeCount} nodes, ${flow.edgeCount} edges`}
                              </div>
                            </div>
                            {isActive ? (
                              <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                            ) : isActivating ? (
                              <Loader2 className="w-4 h-4 text-slate-400 animate-spin flex-shrink-0" />
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Help Text */}
            {activeWorkflow?.active && (
              <div className="mt-3 p-2 bg-slate-50 rounded text-xs text-slate-500">
                <strong>Tip:</strong> Submit failures via{' '}
                <code className="px-1 py-0.5 bg-slate-200 rounded text-[10px]">
                  POST /api/failures
                </code>{' '}
                to trigger this pipeline.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
