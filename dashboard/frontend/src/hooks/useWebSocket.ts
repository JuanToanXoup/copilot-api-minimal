import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store';
import { formatErrorForToast } from '../utils/errorMessages';
import type { Agent, Instance, TaskQueues, FailureState, OrchestratorEvent, PromptMetrics } from '../types';

interface WebSocketHookResult {
  wsRef: React.RefObject<WebSocket | null>;
  sendMessage: (message: object) => void;
}

interface ActivityEvent {
  event_type: string;
  instance_id: string;
  response?: string;
}

interface PromptResult {
  error?: string;
  content?: string;
}

interface WebSocketHandlers {
  onActivityEvent?: (event: ActivityEvent) => void;
  onPromptResult?: (instanceId: string, result: PromptResult) => void;
}

export function useWebSocket(handlers: WebSocketHandlers = {}): WebSocketHookResult {
  const {
    setAgents,
    addActivity,
    setConnected,
    addToast,
    setInstances,
    setTasks,
    setFailures,
    updateFailure,
    addEvent,
    setPromptMetrics,
  } = useStore();

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let reconnectTimeout: ReturnType<typeof setTimeout>;
    let ws: WebSocket | null = null;

    const connect = () => {
      try {
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
            } else if (data.type === 'agent_delta') {
              const { instance_id, changes } = data;
              setAgents((prev: Agent[]) =>
                prev.map((agent) =>
                  agent.instance_id === instance_id
                    ? { ...agent, ...changes }
                    : agent
                )
              );
            } else if (data.type === 'agent_removed') {
              const { instance_id } = data;
              setAgents((prev: Agent[]) =>
                prev.filter((agent) => agent.instance_id !== instance_id)
              );
            } else if (data.type === 'agent_added') {
              const newAgent = data.agent as Agent;
              setAgents((prev: Agent[]) => {
                const exists = prev.some((a) => a.instance_id === newAgent.instance_id);
                if (exists) {
                  return prev.map((a) =>
                    a.instance_id === newAgent.instance_id ? newAgent : a
                  );
                }
                return [...prev, newAgent];
              });
            } else if (data.type === 'activity') {
              addActivity(data.event);
              handlers.onActivityEvent?.(data.event);
            } else if (data.type === 'prompt_result') {
              handlers.onPromptResult?.(data.instance_id, data.result);
            } else if (data.type === 'spawn_result') {
              console.log('Spawn result:', data);
              if (data.error) {
                const { title, description } = formatErrorForToast(data.error);
                addToast({
                  type: 'error',
                  title,
                  message: description,
                });
              } else {
                addToast({
                  type: 'success',
                  title: 'Agent Launched',
                  message: 'New agent is starting up...',
                  duration: 3000,
                });
              }
            }
            // Self-Healing Test Architecture Messages
            else if (data.type === 'instances_update') {
              setInstances(data.instances as Instance[]);
            } else if (data.type === 'tasks_update') {
              setTasks({
                inbound: data.inbound || [],
                work: data.work || [],
                result: data.result || [],
              } as TaskQueues);
            } else if (data.type === 'failure_update') {
              if (data.failure) {
                updateFailure(data.failure.id, data.failure as Partial<FailureState>);
              }
            } else if (data.type === 'failures_list') {
              setFailures(data.failures as FailureState[]);
            } else if (data.type === 'orchestrator_event') {
              addEvent(data.event as OrchestratorEvent);
            } else if (data.type === 'prompt_metrics') {
              setPromptMetrics(data.metrics as PromptMetrics[]);
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

  const sendMessage = useCallback((message: object) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  return { wsRef, sendMessage };
}

/**
 * Send a prompt to an agent and wait for response
 */
export function createPromptSender(wsRef: React.RefObject<WebSocket | null>) {
  return (instanceId: string, prompt: string): Promise<{ error?: string; content?: string }> => {
    return new Promise((resolve) => {
      if (!wsRef.current) {
        resolve({ error: 'Not connected' });
        return;
      }

      const requestId = `${instanceId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      console.log(`[Workflow] Sending request ${requestId} to agent ${instanceId}`);

      const handler = (event: MessageEvent) => {
        const data = JSON.parse(event.data);
        const isMatch = data.type === 'prompt_result' &&
          (data.request_id === requestId || (!data.request_id && data.instance_id === instanceId));

        if (isMatch) {
          console.log(`[Workflow] Received response for request ${requestId}`);
          wsRef.current?.removeEventListener('message', handler);
          resolve(data.result);
        }
      };

      wsRef.current.addEventListener('message', handler);

      wsRef.current.send(JSON.stringify({
        type: 'send_prompt',
        instance_id: instanceId,
        request_id: requestId,
        prompt,
      }));

      setTimeout(() => {
        wsRef.current?.removeEventListener('message', handler);
        resolve({ error: 'Timeout' });
      }, 120000);
    });
  };
}
