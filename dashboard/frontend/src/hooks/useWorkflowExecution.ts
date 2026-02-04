import { useCallback, useRef, useState } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { useStore } from '../store';
import { validateOutput, generateRetryPrompt } from '../utils/outputValidator';
import { getExecutionOrder } from '../utils/workflowVariables';
import { defaultRoleDescriptions, outputTypeInstructions } from '../utils/promptBuilder';
import {
  substituteTemplateVariables,
  extractTemplateOutput,
  getWorkflowOrder,
  getAgentFromNode,
} from '../utils/workflowHelpers';
import type { Agent, PromptBlockNodeData } from '../types';

export type WorkflowStatus = 'idle' | 'running' | 'complete';

interface WorkflowResult {
  role: string;
  response: string;
  timestamp: string;
  port?: number;
}

interface UseWorkflowExecutionProps {
  nodes: Node[];
  edges: Edge[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  sendPromptToAgent: (instanceId: string, prompt: string) => Promise<{ error?: string; content?: string }>;
}

export function useWorkflowExecution({
  nodes,
  edges,
  setNodes,
  sendPromptToAgent,
}: UseWorkflowExecutionProps) {
  const { agents, getPromptTemplateById } = useStore();
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus>('idle');
  const isWorkflowRunningRef = useRef(false);

  // Supervisor-based workflow execution
  const runSupervisorWorkflow = useCallback(async (prompt: string) => {
    if (workflowStatus === 'running') return;

    setWorkflowStatus('running');
    const results: WorkflowResult[] = [];
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
      .filter((a): a is Agent => a !== null && a.connected === true);

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
    const maxIterations = Math.min(connectedAgents.length * 2, 10);
    let iterations = 0;

    for (const agent of connectedAgents) {
      if (iterations >= maxIterations) break;
      iterations++;

      const agentNode = agentNodes.find(n => {
        const a = getAgentFromNode(n);
        return a?.instance_id === agent.instance_id;
      });

      if (!agentNode) continue;

      const preNodeData = agentNode.data as { role?: string; label?: string };
      const displayRole = preNodeData.role || 'coder';
      const displayLabel = preNodeData.label || 'Agent';

      stepCount++;
      history.push({ step: stepCount, action: 'route', agent: `${displayLabel} (${displayRole}) :${agent.port}` });

      setNodes((nds) =>
        nds.map((node) => {
          if (node.type === 'supervisor') {
            return {
              ...node,
              data: {
                ...node.data,
                history: [...history],
                currentStep: `Waiting for ${displayLabel} (${displayRole})...`
              }
            };
          }
          if (node.id === agentNode.id) {
            return { ...node, data: { ...node.data, status: 'running', prompt: currentPrompt } };
          }
          return node;
        })
      );

      const nodeData = agentNode.data as {
        role?: string;
        outputType?: string;
        outputSchema?: string;
        label?: string;
      };
      const role = nodeData.role || 'coder';
      const outputType = nodeData.outputType || 'text';
      const outputSchema = nodeData.outputSchema;
      const nodeLabel = nodeData.label || 'Agent';

      const roleContext = `[Role: ${role.toUpperCase()}] ${defaultRoleDescriptions[role] || ''}
[Expected Output: ${outputType.toUpperCase()}] ${outputTypeInstructions[outputType] || ''}

`;

      const maxRetries = 2;
      let retryCount = 0;
      let finalResponse = '';
      let isError = false;
      let promptToSend = roleContext + currentPrompt;

      while (retryCount <= maxRetries) {
        const result = await sendPromptToAgent(agent.instance_id, promptToSend);
        isError = !!result.error;
        const response = result.content || result.error || 'No response';

        if (isError) {
          finalResponse = response;
          break;
        }

        const validation = validateOutput(response, outputType, outputSchema);

        if (validation.valid) {
          finalResponse = response;

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

        retryCount++;
        if (retryCount <= maxRetries) {
          stepCount++;
          history.push({
            step: stepCount,
            action: 'validate_failed',
            agent: `Agent :${agent.port}`,
            result: `Retry ${retryCount}/${maxRetries}: ${validation.errors.join(', ')}`
          });

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
        role: `${nodeLabel} (${role})`,
        response: finalResponse,
        timestamp: new Date().toISOString(),
        port: agent.port,
      });

      history[history.length - 1].result = finalResponse.slice(0, 100) + (finalResponse.length > 100 ? '...' : '');

      if (!isError) {
        currentPrompt = `Previous agent's output:\n${finalResponse}\n\nPlease review and continue or improve this work.`;
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

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
  }, [nodes, workflowStatus, setNodes, sendPromptToAgent]);

  // Legacy sequential workflow
  const runSequentialWorkflow = useCallback(async (prompt: string) => {
    if (workflowStatus === 'running') return;

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

    const agentNodes = getWorkflowOrder(nodes as Array<{ id: string; type?: string; data?: unknown }>, edges);
    const results: WorkflowResult[] = [];

    let currentPrompt = prompt;

    for (const agentNode of agentNodes) {
      const agent = getAgentFromNode(agentNode as { data?: unknown });
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
  }, [nodes, edges, workflowStatus, setNodes, sendPromptToAgent]);

  // Main workflow runner - dispatches to appropriate handler
  const runWorkflow = useCallback(async (prompt: string) => {
    const hasSupervisor = nodes.some(n => n.type === 'supervisor');
    if (hasSupervisor) {
      return runSupervisorWorkflow(prompt);
    }
    return runSequentialWorkflow(prompt);
  }, [nodes, runSupervisorWorkflow, runSequentialWorkflow]);

  // Prompt block workflow with reference-based architecture
  const runPromptBlockWorkflow = useCallback(async (input: string) => {
    console.log('[Workflow] runPromptBlockWorkflow called, isRunning:', isWorkflowRunningRef.current);

    if (isWorkflowRunningRef.current) {
      console.log('[Workflow] BLOCKED - already running');
      return;
    }

    isWorkflowRunningRef.current = true;
    setWorkflowStatus('running');
    console.log('[Workflow] Started workflow execution');

    try {
      const nodeOutputs: Record<string, unknown> = {};

      setNodes((nds) =>
        nds.map((node) => {
          if (node.type === 'workflowStart') {
            return { ...node, data: { ...node.data, status: 'running' } };
          }
          if (node.type === 'promptBlock') {
            return {
              ...node,
              data: { ...node.data, status: 'waiting', resolvedPrompt: '', response: '', extractedOutput: null },
            };
          }
          if (node.type === 'output') {
            return { ...node, data: { ...node.data, status: 'idle', results: [] } };
          }
          return node;
        })
      );

      await new Promise(resolve => setTimeout(resolve, 100));

      const promptBlockNodes = nodes.filter(n => n.type === 'promptBlock');
      console.log('[Workflow] PromptBlock nodes:', promptBlockNodes.map(n => n.id));

      const executionOrder = getExecutionOrder(nodes, edges);
      console.log('[Workflow] Execution order:', executionOrder);

      const results: Array<{ label: string; response: string; output: unknown }> = [];

      for (const nodeId of executionOrder) {
        const node = nodes.find((n) => n.id === nodeId);
        if (!node || node.type !== 'promptBlock') continue;

        const blockData = node.data as unknown as PromptBlockNodeData;

        const targetAgent = blockData.agentId
          ? agents.find((a) => a.instance_id === blockData.agentId)
          : null;

        if (!targetAgent || !targetAgent.connected) {
          setNodes((nds) =>
            nds.map((n) =>
              n.id === nodeId
                ? {
                    ...n,
                    data: {
                      ...n.data,
                      status: 'error',
                      response: blockData.agentId
                        ? 'Agent not connected'
                        : 'No agent selected',
                    },
                  }
                : n
            )
          );
          continue;
        }

        const template = blockData.promptTemplateId
          ? getPromptTemplateById(blockData.promptTemplateId)
          : null;

        if (!template) {
          setNodes((nds) =>
            nds.map((n) =>
              n.id === nodeId
                ? {
                    ...n,
                    data: {
                      ...n.data,
                      status: 'error',
                      response: 'No prompt template selected',
                    },
                  }
                : n
            )
          );
          continue;
        }

        const resolvedPrompt = substituteTemplateVariables(
          template.template,
          blockData.variableBindings || [],
          input,
          nodeOutputs
        );

        setNodes((nds) =>
          nds.map((n) =>
            n.id === nodeId
              ? { ...n, data: { ...n.data, status: 'running', resolvedPrompt } }
              : n
          )
        );

        await new Promise(resolve => setTimeout(resolve, 100));

        console.log(`[Workflow] >>> STARTING node ${nodeId}`);
        const result = await sendPromptToAgent(targetAgent.instance_id, resolvedPrompt);
        console.log(`[Workflow] <<< COMPLETED node ${nodeId}`);

        const isError = !!result.error;
        const response = result.content || result.error || 'No response';

        const extractedOutput = extractTemplateOutput(
          response,
          template.outputExtraction.mode,
          template.outputExtraction.pattern
        );

        nodeOutputs[nodeId] = { [template.outputExtraction.outputName]: extractedOutput };

        setNodes((nds) =>
          nds.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    status: isError ? 'error' : 'success',
                    response,
                    extractedOutput,
                  },
                }
              : n
          )
        );

        results.push({
          label: blockData.label || template.name,
          response,
          output: extractedOutput,
        });

        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      setNodes((nds) =>
        nds.map((node) => {
          if (node.type === 'workflowStart') {
            return { ...node, data: { ...node.data, status: 'complete' } };
          }
          if (node.type === 'output') {
            return {
              ...node,
              data: {
                ...node.data,
                status: 'complete',
                results: results.map((r) => ({
                  role: r.label,
                  response: typeof r.output === 'string' ? r.output : JSON.stringify(r.output),
                  timestamp: new Date().toISOString(),
                })),
              },
            };
          }
          return node;
        })
      );

      setWorkflowStatus('complete');
    } finally {
      isWorkflowRunningRef.current = false;
    }
  }, [nodes, edges, setNodes, agents, getPromptTemplateById, sendPromptToAgent]);

  return {
    workflowStatus,
    setWorkflowStatus,
    runWorkflow,
    runPromptBlockWorkflow,
    isWorkflowRunningRef,
  };
}
