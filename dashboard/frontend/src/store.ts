import { create } from 'zustand';
import type {
  Agent,
  ActivityEvent,
  Instance,
  TaskQueues,
  FailureState,
  OrchestratorEvent,
  PromptMetrics,
  ViewMode,
  PromptTemplate,
} from './types';

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number; // ms, 0 = no auto-dismiss
}

// Default prompt templates (like Postman's default requests in a collection)
const defaultPromptTemplates: PromptTemplate[] = [
  {
    id: 'classify-failure',
    name: 'Classify Test Failure',
    description: 'Analyze a test failure and classify its type',
    template: `Analyze this test failure and classify it:

{{error_message}}

Classify as one of: ASSERTION, TIMEOUT, NULL_POINTER, NETWORK, CONFIGURATION, UNKNOWN

Respond with JSON: { "classification": "TYPE", "confidence": 0.0-1.0, "reasoning": "..." }`,
    outputExtraction: { mode: 'json', outputName: 'classification' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'generate-fix',
    name: 'Generate Fix',
    description: 'Generate a code fix based on analysis',
    template: `Based on this analysis:

{{analysis}}

Generate a fix for the failing test. Respond with the corrected code.`,
    outputExtraction: { mode: 'full', outputName: 'fix' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'review-code',
    name: 'Review Code',
    description: 'Review code for issues and improvements',
    template: `Review this code:

{{code}}

Provide feedback on:
1. Bugs or issues
2. Performance concerns
3. Code style improvements`,
    outputExtraction: { mode: 'full', outputName: 'review' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'custom',
    name: 'Custom Prompt',
    description: 'A blank template for custom prompts',
    template: '{{input}}',
    outputExtraction: { mode: 'full', outputName: 'output' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

interface Store {
  // Agents (source of truth for agent configurations)
  agents: Agent[];
  setAgents: (agents: Agent[] | ((prev: Agent[]) => Agent[])) => void;
  getAgentById: (instanceId: string) => Agent | undefined;

  // Prompt Templates Registry (source of truth for prompt configurations)
  promptTemplates: PromptTemplate[];
  setPromptTemplates: (templates: PromptTemplate[]) => void;
  addPromptTemplate: (template: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updatePromptTemplate: (id: string, updates: Partial<Omit<PromptTemplate, 'id' | 'createdAt'>>) => void;
  deletePromptTemplate: (id: string) => void;
  getPromptTemplateById: (id: string) => PromptTemplate | undefined;

  // Activity
  activity: ActivityEvent[];
  addActivity: (event: ActivityEvent) => void;
  clearActivity: () => void;

  // Connection
  connected: boolean;
  setConnected: (connected: boolean) => void;

  // Selected agent for workflow
  selectedAgent: string | null;
  setSelectedAgent: (id: string | null) => void;

  // Toast notifications
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, 'id'>) => void;
  removeToast: (id: string) => void;

  // Active project path for project-local storage
  activeProjectPath: string | null;
  setActiveProjectPath: (path: string | null) => void;

  // =====================
  // Self-Healing Test Architecture State
  // =====================

  // View mode toggle
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  // Instance Pool
  instances: Instance[];
  setInstances: (instances: Instance[]) => void;
  updateInstance: (id: string, updates: Partial<Instance>) => void;

  // Task Queues
  tasks: TaskQueues;
  setTasks: (tasks: TaskQueues) => void;

  // Failure States
  failures: FailureState[];
  setFailures: (failures: FailureState[]) => void;
  updateFailure: (id: string, updates: Partial<FailureState>) => void;
  selectedFailureId: string | null;
  setSelectedFailureId: (id: string | null) => void;

  // Orchestrator Events
  events: OrchestratorEvent[];
  addEvent: (event: OrchestratorEvent) => void;
  clearEvents: () => void;
  eventsPaused: boolean;
  setEventsPaused: (paused: boolean) => void;

  // Prompt Metrics
  promptMetrics: PromptMetrics[];
  setPromptMetrics: (metrics: PromptMetrics[]) => void;

  // =====================
  // Mock Data State (for Mock-Monitor tab)
  // =====================
  mockInstances: Instance[];
  setMockInstances: (instances: Instance[]) => void;
  mockTasks: TaskQueues;
  setMockTasks: (tasks: TaskQueues) => void;
  mockFailures: FailureState[];
  setMockFailures: (failures: FailureState[]) => void;
  mockSelectedFailureId: string | null;
  setMockSelectedFailureId: (id: string | null) => void;
  mockEvents: OrchestratorEvent[];
  addMockEvent: (event: OrchestratorEvent) => void;
  clearMockEvents: () => void;
  mockEventsPaused: boolean;
  setMockEventsPaused: (paused: boolean) => void;
  mockPromptMetrics: PromptMetrics[];
  setMockPromptMetrics: (metrics: PromptMetrics[]) => void;
}

let toastIdCounter = 0;
let templateIdCounter = 0;

export const useStore = create<Store>((set, get) => ({
  // Agents (source of truth)
  agents: [],
  setAgents: (agents) => set((state) => ({
    agents: typeof agents === 'function' ? agents(state.agents) : agents,
  })),
  getAgentById: (instanceId) => get().agents.find((a) => a.instance_id === instanceId),

  // Prompt Templates Registry (source of truth)
  promptTemplates: defaultPromptTemplates,
  setPromptTemplates: (templates) => set({ promptTemplates: templates }),
  addPromptTemplate: (template) => {
    const id = `prompt-${++templateIdCounter}-${Date.now()}`;
    const now = new Date().toISOString();
    set((state) => ({
      promptTemplates: [
        ...state.promptTemplates,
        { ...template, id, createdAt: now, updatedAt: now },
      ],
    }));
    return id;
  },
  updatePromptTemplate: (id, updates) => set((state) => ({
    promptTemplates: state.promptTemplates.map((t) =>
      t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
    ),
  })),
  deletePromptTemplate: (id) => set((state) => ({
    promptTemplates: state.promptTemplates.filter((t) => t.id !== id),
  })),
  getPromptTemplateById: (id) => get().promptTemplates.find((t) => t.id === id),

  activity: [],
  addActivity: (event) => set((state) => ({
    activity: [event, ...state.activity].slice(0, 100)
  })),
  clearActivity: () => set({ activity: [] }),

  connected: false,
  setConnected: (connected) => set({ connected }),

  selectedAgent: null,
  setSelectedAgent: (id) => set({ selectedAgent: id }),

  toasts: [],
  addToast: (toast) => set((state) => ({
    toasts: [
      ...state.toasts,
      {
        ...toast,
        id: `toast-${++toastIdCounter}`,
        duration: toast.duration ?? 5000, // Default 5 seconds
      },
    ].slice(-5), // Keep max 5 toasts
  })),
  removeToast: (id) => set((state) => ({
    toasts: state.toasts.filter((t) => t.id !== id),
  })),

  // Active project path for project-local storage
  activeProjectPath: null,
  setActiveProjectPath: (path) => set({ activeProjectPath: path }),

  // =====================
  // Self-Healing Test Architecture State
  // =====================

  // View mode
  viewMode: 'workflow',
  setViewMode: (mode) => set({ viewMode: mode }),

  // Instance Pool
  instances: [],
  setInstances: (instances) => set({ instances }),
  updateInstance: (id, updates) => set((state) => ({
    instances: state.instances.map((instance) =>
      instance.id === id ? { ...instance, ...updates } : instance
    ),
  })),

  // Task Queues
  tasks: { inbound: [], work: [], result: [] },
  setTasks: (tasks) => set({ tasks }),

  // Failure States
  failures: [],
  setFailures: (failures) => set({ failures }),
  updateFailure: (id, updates) => set((state) => ({
    failures: state.failures.map((failure) =>
      failure.id === id ? { ...failure, ...updates } : failure
    ),
  })),
  selectedFailureId: null,
  setSelectedFailureId: (id) => set({ selectedFailureId: id }),

  // Orchestrator Events (max 200, auto-prune oldest)
  events: [],
  addEvent: (event) => set((state) => {
    if (state.eventsPaused) return state;
    // Prevent duplicate event IDs
    if (state.events.some((e) => e.id === event.id)) return state;
    return {
      events: [event, ...state.events].slice(0, 200),
    };
  }),
  clearEvents: () => set({ events: [] }),
  eventsPaused: false,
  setEventsPaused: (paused) => set({ eventsPaused: paused }),

  // Prompt Metrics
  promptMetrics: [],
  setPromptMetrics: (metrics) => set({ promptMetrics: metrics }),

  // =====================
  // Mock Data State (for Mock-Monitor tab)
  // =====================
  mockInstances: [],
  setMockInstances: (instances) => set({ mockInstances: instances }),

  mockTasks: { inbound: [], work: [], result: [] },
  setMockTasks: (tasks) => set({ mockTasks: tasks }),

  mockFailures: [],
  setMockFailures: (failures) => set({ mockFailures: failures }),
  mockSelectedFailureId: null,
  setMockSelectedFailureId: (id) => set({ mockSelectedFailureId: id }),

  mockEvents: [],
  addMockEvent: (event) => set((state) => {
    if (state.mockEventsPaused) return state;
    if (state.mockEvents.some((e) => e.id === event.id)) return state;
    return {
      mockEvents: [event, ...state.mockEvents].slice(0, 200),
    };
  }),
  clearMockEvents: () => set({ mockEvents: [] }),
  mockEventsPaused: false,
  setMockEventsPaused: (paused) => set({ mockEventsPaused: paused }),

  mockPromptMetrics: [],
  setMockPromptMetrics: (metrics) => set({ mockPromptMetrics: metrics }),
}));
