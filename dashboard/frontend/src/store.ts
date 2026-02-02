import { create } from 'zustand';
import type { Agent, ActivityEvent } from './types';

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number; // ms, 0 = no auto-dismiss
}

export interface RoleDefinition {
  id: string;
  label: string;
  description: string; // The actual prompt instructions for this role
  outputInstruction: string; // What kind of output to produce
}

// Default role definitions
const defaultRoleDefinitions: RoleDefinition[] = [
  {
    id: 'coder',
    label: 'Coder',
    description: 'You are a software developer. Write clean, efficient code.',
    outputInstruction: 'Respond with working code.',
  },
  {
    id: 'reviewer',
    label: 'Reviewer',
    description: 'You are a code reviewer. Analyze code for issues, suggest improvements, and identify potential bugs.',
    outputInstruction: 'Provide detailed code review feedback.',
  },
  {
    id: 'tester',
    label: 'Tester',
    description: 'You are a QA engineer. Write comprehensive tests and identify edge cases.',
    outputInstruction: 'Respond with test cases and testing strategies.',
  },
  {
    id: 'architect',
    label: 'Architect',
    description: 'You are a software architect. Design systems, define patterns, and provide high-level technical guidance.',
    outputInstruction: 'Provide architectural recommendations and design decisions.',
  },
  {
    id: 'docs',
    label: 'Docs Writer',
    description: 'You are a technical writer. Create clear, comprehensive documentation and explanations.',
    outputInstruction: 'Respond with well-structured documentation.',
  },
  {
    id: 'debugger',
    label: 'Debugger',
    description: 'You are a debugging specialist. Analyze issues, find root causes, and fix bugs.',
    outputInstruction: 'Identify the problem and provide a fix.',
  },
];

interface Store {
  // Agents
  agents: Agent[];
  setAgents: (agents: Agent[]) => void;

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

  // Role definitions (editable)
  roleDefinitions: RoleDefinition[];
  updateRoleDefinition: (id: string, updates: Partial<Omit<RoleDefinition, 'id'>>) => void;
  resetRoleDefinitions: () => void;
}

let toastIdCounter = 0;

export const useStore = create<Store>((set) => ({
  agents: [],
  setAgents: (agents) => set({ agents }),

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

  roleDefinitions: defaultRoleDefinitions,
  updateRoleDefinition: (id, updates) => set((state) => ({
    roleDefinitions: state.roleDefinitions.map((role) =>
      role.id === id ? { ...role, ...updates } : role
    ),
  })),
  resetRoleDefinitions: () => set({ roleDefinitions: defaultRoleDefinitions }),
}));
