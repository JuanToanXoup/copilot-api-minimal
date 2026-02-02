export interface Agent {
  instance_id: string;
  port: number;
  project_path: string;
  project_name: string;
  role: string | null;
  capabilities: string[];
  agent_name: string | null;
  connected: boolean;
}

export interface ActivityEvent {
  timestamp: string;
  event_type: 'prompt_sent' | 'prompt_response' | 'agent_connected' | 'agent_disconnected';
  port: number;
  instance_id: string;
  role: string | null;
  prompt?: string;
  response?: string;
  status?: string;
}

export interface WorkflowNode {
  id: string;
  type: 'prompt' | 'agent' | 'output';
  data: {
    label: string;
    agent?: Agent;
    prompt?: string;
    response?: string;
    status?: 'idle' | 'running' | 'success' | 'error';
  };
  position: { x: number; y: number };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  animated?: boolean;
}
