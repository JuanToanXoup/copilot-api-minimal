import {
  AlertCircle,
  Server,
  CheckCircle2,
  XCircle,
  CheckSquare,
  XSquare,
  ListPlus,
  UserCheck,
  Power,
  PowerOff,
  type LucideIcon,
} from 'lucide-react';
import type { OrchestratorEventType, OrchestratorEvent } from '../types';

export interface EventTypeConfig {
  label: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
}

export const eventTypeConfigs: Record<OrchestratorEventType, EventTypeConfig> = {
  FAILURE_RECEIVED: {
    label: 'Failure Received',
    icon: AlertCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    description: 'New test failure detected',
  },
  INSTANCE_AVAILABLE: {
    label: 'Instance Available',
    icon: Server,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    description: 'Instance ready for work',
  },
  AGENT_COMPLETED: {
    label: 'Agent Completed',
    icon: CheckCircle2,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    description: 'Agent task completed successfully',
  },
  AGENT_FAILED: {
    label: 'Agent Failed',
    icon: XCircle,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    description: 'Agent task failed',
  },
  VALIDATION_PASSED: {
    label: 'Validation Passed',
    icon: CheckSquare,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    description: 'Fix validated successfully',
  },
  VALIDATION_FAILED: {
    label: 'Validation Failed',
    icon: XSquare,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    description: 'Fix validation failed',
  },
  TASK_QUEUED: {
    label: 'Task Queued',
    icon: ListPlus,
    color: 'text-slate-600',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-200',
    description: 'New task added to queue',
  },
  TASK_ASSIGNED: {
    label: 'Task Assigned',
    icon: UserCheck,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    description: 'Task assigned to instance',
  },
  INSTANCE_SPAWNED: {
    label: 'Instance Spawned',
    icon: Power,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50',
    borderColor: 'border-cyan-200',
    description: 'New instance started',
  },
  INSTANCE_TERMINATED: {
    label: 'Instance Terminated',
    icon: PowerOff,
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    description: 'Instance shut down',
  },
};

export function getEventTypeConfig(eventType: OrchestratorEventType): EventTypeConfig {
  return eventTypeConfigs[eventType] || eventTypeConfigs.TASK_QUEUED;
}

export function formatEventTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function formatEventPayload(event: OrchestratorEvent): string {
  const { type, payload } = event;

  switch (type) {
    case 'FAILURE_RECEIVED':
      return payload.test_file ? `Test: ${payload.test_file}` : 'New failure';
    case 'INSTANCE_AVAILABLE':
    case 'INSTANCE_SPAWNED':
    case 'INSTANCE_TERMINATED':
      return payload.instance_id ? `Instance: ${String(payload.instance_id).slice(0, 8)}` : '';
    case 'AGENT_COMPLETED':
    case 'AGENT_FAILED':
      return payload.task_type ? `Task: ${payload.task_type}` : '';
    case 'VALIDATION_PASSED':
    case 'VALIDATION_FAILED':
      return payload.failure_id ? `Failure: ${String(payload.failure_id).slice(0, 8)}` : '';
    case 'TASK_QUEUED':
    case 'TASK_ASSIGNED':
      return payload.task_type ? `${payload.task_type}${payload.priority === 'high' ? ' (High)' : ''}` : '';
    default:
      return JSON.stringify(payload).slice(0, 50);
  }
}

// Event filter categories
export const eventFilterCategories = [
  {
    id: 'failures',
    label: 'Failures',
    types: ['FAILURE_RECEIVED'] as OrchestratorEventType[],
  },
  {
    id: 'instances',
    label: 'Instances',
    types: ['INSTANCE_AVAILABLE', 'INSTANCE_SPAWNED', 'INSTANCE_TERMINATED'] as OrchestratorEventType[],
  },
  {
    id: 'agents',
    label: 'Agents',
    types: ['AGENT_COMPLETED', 'AGENT_FAILED'] as OrchestratorEventType[],
  },
  {
    id: 'validation',
    label: 'Validation',
    types: ['VALIDATION_PASSED', 'VALIDATION_FAILED'] as OrchestratorEventType[],
  },
  {
    id: 'tasks',
    label: 'Tasks',
    types: ['TASK_QUEUED', 'TASK_ASSIGNED'] as OrchestratorEventType[],
  },
];

export type EventFilterCategory = typeof eventFilterCategories[number]['id'];
