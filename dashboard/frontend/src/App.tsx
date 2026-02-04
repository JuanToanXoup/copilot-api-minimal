import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  BackgroundVariant,
  type Node,
  type Edge,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { LayoutGrid } from 'lucide-react';

import PromptNode from './components/PromptNode';
import AgentNode from './components/AgentNode';
import OutputNode from './components/OutputNode';
import SupervisorNode from './components/SupervisorNode';
import RouterNode from './components/RouterNode';
import AggregatorNode from './components/AggregatorNode';
import EvaluatorNode from './components/EvaluatorNode';
import ConditionNode from './components/ConditionNode';
import HttpRequestNode from './components/HttpRequestNode';
import PromptBlockNode from './components/PromptBlockNode';
import WorkflowStartNode from './components/WorkflowStartNode';
import TemplateSelector from './components/TemplateSelector';
import WorkflowSidebar from './components/WorkflowSidebar';
import NodePalette from './components/NodePalette';
import Sidebar from './components/Sidebar';
import ToastContainer from './components/Toast';
import BlockEditor from './components/BlockEditor';
import ViewModeToggle from './components/ViewModeToggle';
import MonitoringLayout from './components/MonitoringLayout';
import PromptsTab from './components/PromptsTab';
import ProjectSelector from './components/ProjectSelector';
import { useStore } from './store';
import { promptWorkflowTemplates } from './promptWorkflowTemplates';
import { initializeMockData } from './utils/mockData';
import { loadPrompts } from './services/promptService';

// Hooks
import { useWebSocket, createPromptSender } from './hooks/useWebSocket';
import { useCanvasInteractions } from './hooks/useCanvasInteractions';
import { useWorkflowExecution } from './hooks/useWorkflowExecution';
import { useMonitoring } from './hooks/useMonitoring';
import { useFlowManagement } from './hooks/useFlowManagement';

const nodeTypes: NodeTypes = {
  prompt: PromptNode,
  agent: AgentNode,
  output: OutputNode,
  supervisor: SupervisorNode,
  router: RouterNode,
  aggregator: AggregatorNode,
  evaluator: EvaluatorNode,
  condition: ConditionNode,
  httpRequest: HttpRequestNode,
  promptBlock: PromptBlockNode,
  workflowStart: WorkflowStartNode,
};

// Get initial template
const defaultTemplate = promptWorkflowTemplates[0];
const initialNodes: Node[] = defaultTemplate.nodes;
const initialEdges: Edge[] = defaultTemplate.edges;

function AppContent() {
  const {
    agents,
    connected,
    addToast,
    viewMode,
    setViewMode,
    setInstances,
    setTasks,
    setFailures,
    addEvent,
    setPromptMetrics,
    setPromptTemplates,
    activeProjectPath,
  } = useStore();

  // Initialize mock data on mount (for demo purposes)
  // Use a ref to prevent double-initialization in React Strict Mode
  const mockDataInitialized = useRef(false);
  useEffect(() => {
    if (mockDataInitialized.current) return;
    mockDataInitialized.current = true;
    initializeMockData({
      setInstances,
      setTasks,
      setFailures,
      addEvent,
      setPromptMetrics,
      setViewMode,
    });
  }, []);

  // Load prompts on initialization and when project changes
  useEffect(() => {
    const fetchPrompts = async () => {
      try {
        const prompts = await loadPrompts(activeProjectPath);
        if (prompts.length > 0) {
          setPromptTemplates(prompts);
        }
      } catch (error) {
        console.error('Failed to load prompts:', error);
      }
    };
    fetchPrompts();
  }, [activeProjectPath, setPromptTemplates]);

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // WebSocket connection
  const { wsRef } = useWebSocket();

  // Create prompt sender from WebSocket ref
  const sendPromptToAgent = useMemo(
    () => createPromptSender(wsRef),
    [wsRef]
  );

  // Workflow execution
  const {
    setWorkflowStatus,
    runWorkflow,
    runPromptBlockWorkflow,
  } = useWorkflowExecution({
    nodes,
    edges,
    setNodes,
    sendPromptToAgent,
  });

  // Store refs for callbacks (to avoid infinite loops)
  const runWorkflowRef = useRef(runWorkflow);
  runWorkflowRef.current = runWorkflow;
  const runPromptBlockWorkflowRef = useRef(runPromptBlockWorkflow);
  runPromptBlockWorkflowRef.current = runPromptBlockWorkflow;

  // Flow management (templates and loading)
  const {
    selectedTemplate,
    handleSelectTemplate,
    handleLoadFlow,
    initializeCallbacks,
  } = useFlowManagement({
    setNodes,
    setEdges,
    setWorkflowStatus,
    runWorkflowRef,
    runPromptBlockWorkflowRef,
  });

  // Canvas interactions
  const {
    setSelectedNodeId,
    selectedNode,
    onConnect,
    onDrop,
    onDragOver,
    onDragStart,
    onNodeClick,
    onPaneClick,
    handleUpdateNodeData,
    handleAutoArrange,
    handleAddNode,
  } = useCanvasInteractions({
    nodes,
    edges,
    setNodes,
    setEdges,
  });

  // Monitoring commands
  const {
    handleSpawnInstance,
    handleRetryFailure,
    handleEscalateFailure,
  } = useMonitoring({ wsRef, connected, viewMode });

  // Initialize callbacks on mount
  useEffect(() => {
    initializeCallbacks();
  }, []);

  // Spawn agent handler
  const onSpawnAgent = useCallback((projectPath: string) => {
    if (!wsRef.current) {
      console.error('WebSocket not connected');
      addToast({
        type: 'error',
        title: 'Not Connected',
        message: 'Cannot spawn agent while disconnected from backend.',
      });
      return;
    }

    console.log('Spawning agent:', { projectPath });
    wsRef.current.send(JSON.stringify({
      type: 'spawn_agent',
      project_path: projectPath,
    }));
  }, [addToast, wsRef]);

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-100">
      {/* Toast notifications */}
      <ToastContainer />

      {/* Header */}
      <div className="flex-shrink-0">
        {/* Top bar - dark */}
        <div className="h-12 bg-slate-800 px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="font-semibold text-white text-lg">Agent Dashboard</h1>
            {/* Connection Status */}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-700">
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
              <span className="text-xs text-slate-300">
                {connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>

        {/* Sub bar - navigation + project */}
        <div className="h-12 bg-white border-b border-slate-200 px-4 flex items-center justify-between shadow-sm">
          <ViewModeToggle />
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 uppercase tracking-wide">Project:</span>
            <div className="w-[28rem]">
              <ProjectSelector />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden p-4 gap-4 min-h-0">
        {viewMode === 'prompts' && <PromptsTab />}

        {viewMode === 'workflow' && (
          <>
            {/* Left sidebar: Saved Workflows */}
            <WorkflowSidebar
              nodes={nodes}
              edges={edges}
              selectedTemplate={selectedTemplate}
              onLoadFlow={handleLoadFlow}
            />

            <div className="flex-1 flex relative gap-4 min-h-0">
              {/* Canvas area */}
              <div className="flex-1 relative min-h-0" style={{ width: '100%', height: '100%' }}>
                {/* Top toolbar */}
                <div className="absolute top-4 left-4 right-4 z-10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TemplateSelector
                        selectedTemplate={selectedTemplate}
                        onSelectTemplate={handleSelectTemplate}
                      />
                      <NodePalette onAddNode={handleAddNode} />
                    </div>
                    <button
                      onClick={handleAutoArrange}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg shadow-sm border border-slate-200 hover:bg-slate-50 transition-colors text-sm text-slate-600"
                      title="Auto-arrange nodes"
                    >
                      <LayoutGrid className="w-4 h-4" />
                      <span>Auto Layout</span>
                    </button>
                  </div>
                </div>

                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  onDrop={onDrop}
                  onDragOver={onDragOver}
                  onNodeClick={onNodeClick}
                  onPaneClick={onPaneClick}
                  nodeTypes={nodeTypes}
                  fitView
                  className="bg-slate-50"
                >
                  <Controls className="bg-white border border-slate-200 rounded-lg" />
                  <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#cbd5e1" />
                </ReactFlow>
              </div>

              {/* Block Editor Panel */}
              {selectedNode && (
                <BlockEditor
                  node={selectedNode}
                  onClose={() => setSelectedNodeId(null)}
                  onUpdateNode={handleUpdateNodeData}
                />
              )}
            </div>
          </>
        )}

        {viewMode === 'agents' && (
          /* Agents Mode - Connected instances */
          <div className="flex-1 flex gap-4">
            <div className="w-80 bg-white border border-slate-200 rounded-lg shadow-sm flex flex-col h-full overflow-hidden">
              <Sidebar agents={agents} onDragStart={onDragStart} onSpawnAgent={onSpawnAgent} />
            </div>
            <div className="flex-1 bg-white border border-slate-200 rounded-lg shadow-sm flex items-center justify-center">
              <div className="text-center text-slate-400">
                <p className="text-lg font-medium mb-2">Connected Agents</p>
                <p className="text-sm">
                  {agents.filter(a => a.connected).length} of {agents.length} agents connected
                </p>
                <p className="text-xs mt-4">
                  Use the sidebar to spawn new agents or manage existing ones.
                  <br />
                  Switch to <strong>Workflow</strong> tab to build prompt workflows.
                </p>
              </div>
            </div>
          </div>
        )}

        {viewMode === 'monitoring' && (
          /* Monitoring Mode */
          <MonitoringLayout
            onSpawnInstance={handleSpawnInstance}
            onRetryFailure={handleRetryFailure}
            onEscalateFailure={handleEscalateFailure}
          />
        )}
      </div>
    </div>
  );
}

// Wrap with ReactFlowProvider to enable useReactFlow hook
export default function App() {
  return (
    <ReactFlowProvider>
      <AppContent />
    </ReactFlowProvider>
  );
}
