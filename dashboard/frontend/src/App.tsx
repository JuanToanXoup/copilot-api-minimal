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
import SupervisorNode from './components/SupervisorNode';
import RouterNode from './components/RouterNode';
import AggregatorNode from './components/AggregatorNode';
import EvaluatorNode from './components/EvaluatorNode';
import TemplateSelector from './components/TemplateSelector';
import FlowManager from './components/FlowManager';
import Sidebar from './components/Sidebar';
import { useStore } from './store';
import { workflowTemplates, type WorkflowTemplate } from './workflowTemplates';
import { validateOutput, generateRetryPrompt } from './utils/outputValidator';
import type { Agent } from './types';

const nodeTypes: NodeTypes = {
  prompt: PromptNode,
  agent: AgentNode,
  output: OutputNode,
  supervisor: SupervisorNode,
  router: RouterNode,
  aggregator: AggregatorNode,
  evaluator: EvaluatorNode,
};

// Get initial template
const defaultTemplate = workflowTemplates[0];
const initialNodes: Node[] = defaultTemplate.nodes;
const defaultEdges: Edge[] = defaultTemplate.edges;

const initialEdges: Edge[] = defaultEdges;

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
  const [selectedTemplate, setSelectedTemplate] = useState<string>(defaultTemplate.id);
  const wsRef = useRef<WebSocket | null>(null);
  const nodeIdCounter = useRef(10);

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

  // Supervisor-based workflow execution
  const runSupervisorWorkflow = useCallback(async (prompt: string) => {
    if (!wsRef.current || workflowStatus === 'running') return;

    setWorkflowStatus('running');
    const results: Array<{ role: string; response: string; timestamp: string; port?: number }> = [];
    const history: Array<{ step: number; action: string; agent?: string; result?: string }> = [];
    let stepCount = 0;

    // Reset all nodes
    setNodes((nds) =>
      nds.map((node) => {
        if (node.type === 'supervisor') {
          return { ...node, data: { ...node.data, status: 'thinking', history: [], currentStep: 'Analyzing task...' } };
        }
        if (node.type === 'agent') {
          return { ...node, data: { ...node.data, status: 'idle', prompt: '', response: '' } };
        }
        if (node.type === 'output') {
          return { ...node, data: { ...node.data, status: 'idle', results: [] } };
        }
        return node;
      })
    );

    // Get connected agents from the canvas
    const agentNodes = nodes.filter(n => n.type === 'agent');
    const connectedAgents = agentNodes
      .map(n => getAgentFromNode(n))
      .filter((a): a is Agent => a !== null && a.connected);

    if (connectedAgents.length === 0) {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.type === 'supervisor') {
            return { ...node, data: { ...node.data, status: 'idle', currentStep: 'No agents connected!' } };
          }
          return node;
        })
      );
      setWorkflowStatus('idle');
      return;
    }

    // Supervisor decides which agent to use first
    stepCount++;
    history.push({ step: stepCount, action: 'analyze', result: `Task: ${prompt.slice(0, 50)}...` });

    // Update supervisor with analysis step
    setNodes((nds) =>
      nds.map((node) => {
        if (node.type === 'supervisor') {
          return { ...node, data: { ...node.data, status: 'routing', history: [...history], currentStep: 'Routing to first agent...' } };
        }
        return node;
      })
    );

    // Simple routing: use agents in order they appear on canvas
    let currentPrompt = prompt;
    const maxIterations = Math.min(connectedAgents.length * 2, 10); // Prevent infinite loops
    let iterations = 0;

    for (const agent of connectedAgents) {
      if (iterations >= maxIterations) break;
      iterations++;

      // Find the agent node
      const agentNode = agentNodes.find(n => {
        const a = getAgentFromNode(n);
        return a?.instance_id === agent.instance_id;
      });

      if (!agentNode) continue;

      stepCount++;
      history.push({ step: stepCount, action: 'route', agent: `Agent :${agent.port}` });

      // Update supervisor and agent status
      setNodes((nds) =>
        nds.map((node) => {
          if (node.type === 'supervisor') {
            return {
              ...node,
              data: {
                ...node.data,
                history: [...history],
                currentStep: `Waiting for Agent :${agent.port}...`
              }
            };
          }
          if (node.id === agentNode.id) {
            return { ...node, data: { ...node.data, status: 'running', prompt: currentPrompt } };
          }
          return node;
        })
      );

      // Send to agent with validation and retry logic
      const nodeData = agentNode.data as { outputType?: string; outputSchema?: string };
      const outputType = nodeData.outputType || 'text';
      const outputSchema = nodeData.outputSchema;
      const maxRetries = 2;
      let retryCount = 0;
      let finalResponse = '';
      let isError = false;
      let promptToSend = currentPrompt;

      while (retryCount <= maxRetries) {
        const result = await sendPromptToAgent(agent.instance_id, promptToSend);
        isError = !!result.error;
        const response = result.content || result.error || 'No response';

        if (isError) {
          finalResponse = response;
          break;
        }

        // Validate output against expected type and schema
        const validation = validateOutput(response, outputType, outputSchema);

        if (validation.valid) {
          finalResponse = response;

          // Update agent with validated response
          setNodes((nds) =>
            nds.map((node) => {
              if (node.id === agentNode.id) {
                return {
                  ...node,
                  data: {
                    ...node.data,
                    status: 'success',
                    response
                  }
                };
              }
              return node;
            })
          );
          break;
        }

        // Validation failed - retry if we have attempts left
        retryCount++;
        if (retryCount <= maxRetries) {
          stepCount++;
          history.push({
            step: stepCount,
            action: 'validate_failed',
            agent: `Agent :${agent.port}`,
            result: `Retry ${retryCount}/${maxRetries}: ${validation.errors.join(', ')}`
          });

          // Update status to show retrying
          setNodes((nds) =>
            nds.map((node) => {
              if (node.type === 'supervisor') {
                return {
                  ...node,
                  data: {
                    ...node.data,
                    history: [...history],
                    currentStep: `Retrying Agent :${agent.port} (${retryCount}/${maxRetries})...`
                  }
                };
              }
              if (node.id === agentNode.id) {
                return {
                  ...node,
                  data: {
                    ...node.data,
                    status: 'waiting',
                    response: `Validation failed: ${validation.errors.join(', ')}`
                  }
                };
              }
              return node;
            })
          );

          // Generate retry prompt
          let schema = {};
          try {
            if (outputSchema) schema = JSON.parse(outputSchema);
          } catch { /* ignore */ }

          promptToSend = generateRetryPrompt(
            currentPrompt,
            response,
            outputType,
            schema,
            validation
          );

          await new Promise(resolve => setTimeout(resolve, 500));
        } else {
          // Max retries reached, use last response anyway
          finalResponse = response;
          stepCount++;
          history.push({
            step: stepCount,
            action: 'max_retries',
            agent: `Agent :${agent.port}`,
            result: `Using response despite validation errors: ${validation.errors.join(', ')}`
          });
        }
      }

      // Update agent with final response
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === agentNode.id) {
            return {
              ...node,
              data: {
                ...node.data,
                status: isError ? 'error' : 'success',
                response: finalResponse
              }
            };
          }
          return node;
        })
      );

      results.push({
        role: `Agent :${agent.port}`,
        response: finalResponse,
        timestamp: new Date().toISOString(),
        port: agent.port,
      });

      // Update history with result summary
      history[history.length - 1].result = finalResponse.slice(0, 100) + (finalResponse.length > 100 ? '...' : '');

      // Prepare prompt for next agent (if any)
      if (!isError) {
        currentPrompt = `Previous agent's output:\n${finalResponse}\n\nPlease review and continue or improve this work.`;
      }

      // Small delay between agents for visual effect
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Mark workflow complete
    stepCount++;
    history.push({ step: stepCount, action: 'complete', result: 'Workflow finished' });

    setNodes((nds) =>
      nds.map((node) => {
        if (node.type === 'supervisor') {
          return {
            ...node,
            data: {
              ...node.data,
              status: 'complete',
              history: [...history],
              currentStep: 'Workflow complete',
              decision: `Processed by ${results.length} agent(s)`
            }
          };
        }
        if (node.type === 'output') {
          return { ...node, data: { ...node.data, status: 'complete', results } };
        }
        return node;
      })
    );

    setWorkflowStatus('complete');
  }, [nodes, workflowStatus, setNodes]);

  // Legacy sequential workflow (keeping for backward compatibility)
  const runWorkflow = useCallback(async (prompt: string) => {
    // Check if we have a supervisor node
    const hasSupervisor = nodes.some(n => n.type === 'supervisor');
    if (hasSupervisor) {
      return runSupervisorWorkflow(prompt);
    }

    // Original sequential logic for non-supervisor workflows
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
    const results: Array<{ role: string; response: string; timestamp: string; port?: number }> = [];

    let currentPrompt = prompt;

    for (const agentNode of agentNodes) {
      const agent = getAgentFromNode(agentNode);
      if (!agent || !agent.connected) continue;

      setNodes((nds) =>
        nds.map((node) =>
          node.id === agentNode.id
            ? { ...node, data: { ...node.data, status: 'running', prompt: currentPrompt } }
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
        port: agent.port,
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
  }, [nodes, edges, workflowStatus, setNodes, runSupervisorWorkflow]);

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
        if (node.type === 'supervisor') {
          return {
            ...node,
            data: {
              ...node.data,
              onStart: (prompt: string) => runWorkflowRef.current(prompt),
            },
          };
        }
        return node;
      })
    );
  }, []); // Only run once on mount

  // Handle template selection
  const handleSelectTemplate = useCallback((template: WorkflowTemplate) => {
    setSelectedTemplate(template.id);
    setWorkflowStatus('idle');

    // Deep clone the template nodes and edges to avoid mutation
    const newNodes = template.nodes.map(node => ({
      ...node,
      data: { ...node.data },
    }));
    const newEdges = template.edges.map(edge => ({ ...edge }));

    setNodes(newNodes);
    setEdges(newEdges);

    // Re-attach callbacks after a tick
    setTimeout(() => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.type === 'supervisor') {
            return {
              ...node,
              data: {
                ...node.data,
                onStart: (prompt: string) => runWorkflowRef.current(prompt),
              },
            };
          }
          return node;
        })
      );
    }, 0);
  }, [setNodes, setEdges]);

  // Handle loading a flow (from FlowManager)
  const handleLoadFlow = useCallback((loadedNodes: Node[], loadedEdges: Edge[], templateId?: string) => {
    setNodes(loadedNodes);
    setEdges(loadedEdges);
    if (templateId) {
      setSelectedTemplate(templateId);
    }
    setWorkflowStatus('idle');

    // Re-attach callbacks after loading
    setTimeout(() => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.type === 'supervisor') {
            return {
              ...node,
              data: {
                ...node.data,
                onStart: (prompt: string) => runWorkflowRef.current(prompt),
              },
            };
          }
          return node;
        })
      );
    }, 0);
  }, [setNodes, setEdges]);

  return (
    <div className="flex h-screen w-screen">
      {/* Left sidebar: Templates + Agents */}
      <div className="w-72 bg-white border-r border-slate-200 flex flex-col h-full overflow-hidden">
        {/* Template Selector */}
        <div className="p-4 border-b border-slate-200">
          <TemplateSelector
            selectedTemplate={selectedTemplate}
            onSelectTemplate={handleSelectTemplate}
          />
        </div>

        {/* Agent list - flex container for Sidebar's internal layout */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <Sidebar agents={agents} onDragStart={onDragStart} onSpawnAgent={onSpawnAgent} />
        </div>
      </div>

      <div className="flex-1 relative">
        {/* Top toolbar */}
        <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between">
          {/* Flow Manager */}
          <div className="bg-white px-3 py-1.5 rounded-lg shadow-sm border border-slate-200">
            <FlowManager
              nodes={nodes}
              edges={edges}
              selectedTemplate={selectedTemplate}
              onLoadFlow={handleLoadFlow}
            />
          </div>

          {/* Connection Status */}
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full shadow-sm border border-slate-200">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-slate-600">
              {connected ? 'Connected' : 'Disconnected'}
            </span>
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
