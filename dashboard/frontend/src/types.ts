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

// =====================
// Self-Healing Test Architecture Types
// =====================

// Instance Pool
export interface Instance {
  id: string;
  port: number;
  status: 'spawning' | 'available' | 'busy' | 'idle' | 'terminated';
  current_task?: string;
  started_at: string;
  idle_since?: string;
}

// Task Queue
export type TaskType = 'CLASSIFY' | 'INSPECT_PLAN' | 'INSPECT_ANALYZE' | 'FIX_GEN' | 'VALIDATE_PLAN' | 'VALIDATE_ANALYZE';
export type TaskPriority = 'high' | 'normal' | 'low';
export type TaskStatus = 'queued' | 'assigned' | 'completed' | 'failed';

export interface Task {
  id: string;
  failure_id: string;
  task_type: TaskType;
  priority: TaskPriority;
  assigned_instance?: string;
  status: TaskStatus;
  created_at: string;
}

export interface TaskQueues {
  inbound: Task[];
  work: Task[];
  result: Task[];
}

// Failure State
export type FailureStatus = 'pending' | 'processing' | 'fixed' | 'escalated';
export type FailurePhase = 'classification' | 'inspection' | 'fix_generation' | 'validation';

export interface TaskHistoryEntry {
  task_id: string;
  task_type: TaskType;
  status: TaskStatus;
  started_at: string;
  completed_at?: string;
  result?: string;
  error?: string;
}

export interface FailureState {
  id: string;
  version: number;
  status: FailureStatus;
  phase: FailurePhase;
  test_file: string;
  error_message: string;
  stack_trace?: string;
  retries: Record<string, number>;
  task_history: TaskHistoryEntry[];
  created_at: string;
  updated_at: string;
}

// Events
export type OrchestratorEventType =
  | 'FAILURE_RECEIVED'
  | 'INSTANCE_AVAILABLE'
  | 'AGENT_COMPLETED'
  | 'AGENT_FAILED'
  | 'VALIDATION_PASSED'
  | 'VALIDATION_FAILED'
  | 'TASK_QUEUED'
  | 'TASK_ASSIGNED'
  | 'INSTANCE_SPAWNED'
  | 'INSTANCE_TERMINATED';

export interface OrchestratorEvent {
  id: string;
  timestamp: string;
  type: OrchestratorEventType;
  payload: Record<string, unknown>;
}

// Prompt Metrics
export interface PromptMetrics {
  prompt_name: string;
  agent_type: string;
  version: string;
  attempts: number;
  successes: number;
  first_attempt_success_rate: number;
  avg_duration_ms: number;
  last_used?: string;
}

// View Mode
export type ViewMode = 'workflow' | 'monitoring' | 'agents';
