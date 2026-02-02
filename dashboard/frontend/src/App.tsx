import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  BackgroundVariant,
  type Connection,
  type Node,
  type Edge,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import PromptNode from './components/PromptNode';
import AgentNode from './components/AgentNode';
import OutputNode from './components/OutputNode';
import Sidebar from './components/Sidebar';
import { useStore } from './store';
import type { Agent } from './types';

const nodeTypes: NodeTypes = {
  prompt: PromptNode,
  agent: AgentNode,
  output: OutputNode,
};

// Initial nodes for the workflow
const initialNodes: Node[] = [
  {
    id: 'prompt-1',
    type: 'prompt',
    position: { x: 50, y: 200 },
    data: {
      label: 'Start',
      prompt: '',
      status: 'idle',
      onSubmit: () => {},
    },
  },
  {
    id: 'output-1',
    type: 'output',
    position: { x: 900, y: 200 },
    data: {
      label: 'Output',
      results: [],
      status: 'idle',
    },
  },
];

const initialEdges: Edge[] = [];

// Helper to safely access node data
function getAgentFromNode(node: Node): Agent | null {
  const data = node.data as { agent?: Agent };
  return data?.agent || null;
}

export default function App() {
  const { agents, setAgents, addActivity, connected, setConnected } = useStore();
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [workflowStatus, setWorkflowStatus] = useState<'idle' | 'running' | 'complete'>('idle');
  const wsRef = useRef<WebSocket | null>(null);
  const nodeIdCounter = useRef(2);

  // Connect to backend WebSocket
  useEffect(() => {
    let reconnectTimeout: ReturnType<typeof setTimeout>;
    let ws: WebSocket | null = null;

    const connect = () => {
      try {
        // Connect directly to backend port
        const wsUrl = `ws://localhost:8080/ws`;
        console.log('Connecting to:', wsUrl);
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('Connected to backend');
          setConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.type === 'initial') {
              setAgents(data.agents || []);
              (data.activity || []).forEach((e: unknown) => addActivity(e as any));
            } else if (data.type === 'agents_update') {
              setAgents(data.agents || []);
            } else if (data.type === 'activity') {
              addActivity(data.event);
              handleActivityEvent(data.event);
            } else if (data.type === 'prompt_result') {
              handlePromptResult(data.instance_id, data.result);
            } else if (data.type === 'spawn_result') {
              console.log('Spawn result:', data);
              if (data.error) {
                alert(`Failed to spawn agent: ${data.error}`);
              }
              // Success case: no dialog, agent will appear in sidebar when ready
            }
          } catch (err) {
            console.error('Error parsing message:', err);
          }
        };

        ws.onclose = () => {
          console.log('Disconnected from backend');
          setConnected(false);
          reconnectTimeout = setTimeout(connect, 3000);
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setConnected(false);
        };

        wsRef.current = ws;
      } catch (err) {
        console.error('Failed to create WebSocket:', err);
        setConnected(false);
        reconnectTimeout = setTimeout(connect, 3000);
      }
    };

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      ws?.close();
    };
  }, []);

  const handleActivityEvent = useCallback((event: { event_type: string; instance_id: string; response?: string }) => {
    if (event.event_type === 'prompt_response') {
      setNodes((nds) =>
        nds.map((node) => {
          const agent = getAgentFromNode(node);
          if (node.type === 'agent' && agent?.instance_id === event.instance_id) {
            return {
              ...node,
              data: {
                ...node.data,
                status: 'success',
                response: event.response,
              },
            };
          }
          return node;
        })
      );
    }
  }, [setNodes]);

  const handlePromptResult = useCallback((instanceId: string, result: { error?: string; content?: string }) => {
    setNodes((nds) =>
      nds.map((node) => {
        const agent = getAgentFromNode(node);
        if (node.type === 'agent' && agent?.instance_id === instanceId) {
          const isError = !!result.error;
          return {
            ...node,
            data: {
              ...node.data,
              status: isError ? 'error' : 'success',
              response: result.content || result.error,
            },
          };
        }
        return node;
      })
    );
  }, [setNodes]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [setEdges]
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const agentData = event.dataTransfer.getData('application/agent');
      if (!agentData) return;

      const agent: Agent = JSON.parse(agentData);
      const position = {
        x: event.clientX - 300,
        y: event.clientY - 100,
      };

      const newNode: Node = {
        id: `agent-${nodeIdCounter.current++}`,
        type: 'agent',
        position,
        data: {
          label: agent.role || 'Agent',
          agent,
          status: 'idle',
          response: '',
        },
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDragStart = useCallback((event: React.DragEvent, agent: Agent) => {
    event.dataTransfer.setData('application/agent', JSON.stringify(agent));
    event.dataTransfer.effectAllowed = 'move';
  }, []);

  const onSpawnAgent = useCallback((projectPath: string, role: string) => {
    if (!wsRef.current) {
      console.error('WebSocket not connected');
      alert('Not connected to backend');
      return;
    }

    console.log('Spawning agent:', { projectPath, role });
    wsRef.current.send(JSON.stringify({
      type: 'spawn_agent',
      project_path: projectPath,
      role: role,
    }));
  }, []);

  const runWorkflow = useCallback(async (prompt: string) => {
    if (!wsRef.current || workflowStatus === 'running') return;

    setWorkflowStatus('running');

    setNodes((nds) =>
      nds.map((node) => {
        if (node.type === 'prompt') {
          return { ...node, data: { ...node.data, status: 'running', prompt } };
        }
        if (node.type === 'agent') {
          return { ...node, data: { ...node.data, status: 'idle', response: '' } };
        }
        if (node.type === 'output') {
          return { ...node, data: { ...node.data, status: 'idle', results: [] } };
        }
        return node;
      })
    );

    const agentNodes = getWorkflowOrder(nodes, edges);
    const results: Array<{ role: string; response: string; timestamp: string }> = [];

    let currentPrompt = prompt;

    for (const agentNode of agentNodes) {
      const agent = getAgentFromNode(agentNode);
      if (!agent || !agent.connected) continue;

      setNodes((nds) =>
        nds.map((node) =>
          node.id === agentNode.id
            ? { ...node, data: { ...node.data, status: 'running' } }
            : node
        )
      );

      const result = await sendPromptToAgent(agent.instance_id, currentPrompt);

      const isError = !!result.error;
      const response = result.content || result.error || 'No response';

      setNodes((nds) =>
        nds.map((node) =>
          node.id === agentNode.id
            ? {
                ...node,
                data: {
                  ...node.data,
                  status: isError ? 'error' : 'success',
                  response,
                },
              }
            : node
        )
      );

      results.push({
        role: agent.role || 'agent',
        response,
        timestamp: new Date().toISOString(),
      });

      if (!isError && response) {
        currentPrompt = `Previous step (${agent.role || 'agent'}) output:\n${response}\n\nContinue with the workflow.`;
      }
    }

    setNodes((nds) =>
      nds.map((node) => {
        if (node.type === 'output') {
          return { ...node, data: { ...node.data, status: 'complete', results } };
        }
        if (node.type === 'prompt') {
          return { ...node, data: { ...node.data, status: 'success' } };
        }
        return node;
      })
    );

    setWorkflowStatus('complete');
  }, [nodes, edges, workflowStatus, setNodes]);

  const sendPromptToAgent = (instanceId: string, prompt: string): Promise<{ error?: string; content?: string }> => {
    return new Promise((resolve) => {
      if (!wsRef.current) {
        resolve({ error: 'Not connected' });
        return;
      }

      const handler = (event: MessageEvent) => {
        const data = JSON.parse(event.data);
        if (data.type === 'prompt_result' && data.instance_id === instanceId) {
          wsRef.current?.removeEventListener('message', handler);
          resolve(data.result);
        }
      };

      wsRef.current.addEventListener('message', handler);

      wsRef.current.send(JSON.stringify({
        type: 'send_prompt',
        instance_id: instanceId,
        prompt,
      }));

      setTimeout(() => {
        wsRef.current?.removeEventListener('message', handler);
        resolve({ error: 'Timeout' });
      }, 120000);
    });
  };

  const getWorkflowOrder = (nodes: Node[], edges: Edge[]): Node[] => {
    const order: Node[] = [];
    const visited = new Set<string>();

    const promptNode = nodes.find((n) => n.type === 'prompt');
    if (!promptNode) return order;

    const queue: string[] = [promptNode.id];
    visited.add(promptNode.id);

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const currentNode = nodes.find((n) => n.id === currentId);

      if (currentNode?.type === 'agent') {
        order.push(currentNode);
      }

      const connectedEdges = edges.filter((e) => e.source === currentId);
      for (const edge of connectedEdges) {
        if (!visited.has(edge.target)) {
          visited.add(edge.target);
          queue.push(edge.target);
        }
      }
    }

    return order;
  };

  // Use ref to avoid infinite loop with runWorkflow dependency
  const runWorkflowRef = useRef(runWorkflow);
  runWorkflowRef.current = runWorkflow;

  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.type === 'prompt') {
          return {
            ...node,
            data: {
              ...node.data,
              onSubmit: (prompt: string) => runWorkflowRef.current(prompt),
            },
          };
        }
        return node;
      })
    );
  }, []); // Only run once on mount

  return (
    <div className="flex h-screen w-screen">
      <Sidebar agents={agents} onDragStart={onDragStart} onSpawnAgent={onSpawnAgent} />

      <div className="flex-1 relative">
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-white px-3 py-1.5 rounded-full shadow-sm border border-slate-200">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm text-slate-600">
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={nodeTypes}
          fitView
          className="bg-slate-50"
        >
          <Controls className="bg-white border border-slate-200 rounded-lg" />
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#cbd5e1" />
        </ReactFlow>
      </div>
    </div>
  );
}
