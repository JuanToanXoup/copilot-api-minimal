import { create } from 'zustand';
import type { Agent, ActivityEvent } from './types';

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
}

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
}));
