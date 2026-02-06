export type AgentHealth = 'healthy' | 'stale' | 'disconnected';

export interface Agent {
  instance_id: string;
  port: number;
  project_path: string;
  project_name: string;
  capabilities: string[];
  connected: boolean;
  last_heartbeat?: string;
  health?: AgentHealth;
  busy?: boolean;
}

export interface ActivityEvent {
  timestamp: string;
  event_type: 'prompt_sent' | 'prompt_response' | 'agent_connected' | 'agent_disconnected';
  port: number;
  instance_id: string;
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
export type ViewMode = 'prompts' | 'workflow' | 'monitoring' | 'agents';

// =====================
// Prompt Registry (Postman Flows Pattern)
// =====================

// Output extraction modes
export type ExtractionMode = 'full' | 'json' | 'jsonpath' | 'regex' | 'first_line';

// Priority levels for prompts (spec-kit inspired)
export type PromptPriority = 'P1' | 'P2' | 'P3';

// A reusable prompt template stored in the registry (like a Postman Request in a Collection)
export interface PromptTemplate {
  id: string;
  name: string;
  description?: string;
  // Category for organizing prompts
  category?: string;
  // Tags for additional categorization
  tags?: string[];
  // Priority level for workflow ordering
  priority?: PromptPriority;
  // Version for tracking prompt iterations
  version?: string;
  // The prompt template with {{variable}} placeholders
  template: string;
  // Output extraction configuration
  outputExtraction: {
    mode: ExtractionMode;
    pattern?: string; // For regex or jsonpath
    outputName: string;
  };
  // Metadata
  createdAt: string;
  updatedAt: string;
}

// Variable binding - how a variable gets its value at runtime
// Note: {{input}} always comes from workflow start - no binding needed
// Other variables default to auto-resolve from upstream connections
export interface VariableBinding {
  variableName: string; // The {{variable}} name
  source: 'upstream' | 'static'; // upstream = auto from connections, static = hardcoded
  staticValue?: string; // If static, the fixed value
}

// Simplified PromptBlock node data - stores REFERENCES, not full objects
export interface PromptBlockNodeData {
  label: string;
  description?: string;
  // Reference to agent by instance_id (source of truth is agents array in store)
  agentId: string | null;
  // Reference to prompt template by id (source of truth is promptTemplates in store)
  promptTemplateId: string | null;
  // Runtime variable bindings (overrides for this specific block instance)
  variableBindings: VariableBinding[];
  // Declared inputs - only these context fields will be passed to the prompt
  // Examples: ["error_message", "test_file", "previous_node_id.response"]
  inputs: string[];
  // Runtime state (not persisted)
  status: 'idle' | 'waiting' | 'running' | 'success' | 'error';
  resolvedPrompt?: string; // The prompt after variable substitution
  response?: string;
  extractedOutput?: unknown;
}
