import {
  Tag,
  Search,
  FileSearch,
  Wrench,
  CheckSquare,
  FileCheck,
  ArrowUp,
  Minus,
  ArrowDown,
  type LucideIcon,
} from 'lucide-react';
import type { TaskType, TaskPriority, TaskStatus, FailurePhase } from '../types';

// Task Type Configuration
export interface TaskTypeConfig {
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  description: string;
}

export const taskTypeConfigs: Record<TaskType, TaskTypeConfig> = {
  CLASSIFY: {
    label: 'Classification',
    shortLabel: 'Classify',
    icon: Tag,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    description: 'Categorize the failure type',
  },
  INSPECT_PLAN: {
    label: 'Inspection Plan',
    shortLabel: 'Insp Plan',
    icon: Search,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    description: 'Plan inspection strategy',
  },
  INSPECT_ANALYZE: {
    label: 'Inspection Analysis',
    shortLabel: 'Insp Analyze',
    icon: FileSearch,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-100',
    description: 'Analyze inspection results',
  },
  FIX_GEN: {
    label: 'Fix Generation',
    shortLabel: 'Fix Gen',
    icon: Wrench,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    description: 'Generate code fix',
  },
  VALIDATE_PLAN: {
    label: 'Validation Plan',
    shortLabel: 'Val Plan',
    icon: CheckSquare,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    description: 'Plan validation strategy',
  },
  VALIDATE_ANALYZE: {
    label: 'Validation Analysis',
    shortLabel: 'Val Analyze',
    icon: FileCheck,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100',
    description: 'Analyze validation results',
  },
};

export function getTaskTypeConfig(taskType: TaskType): TaskTypeConfig {
  return taskTypeConfigs[taskType] || taskTypeConfigs.CLASSIFY;
}

// Task Priority Configuration
export interface TaskPriorityConfig {
  label: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  borderColor: string;
}

export const taskPriorityConfigs: Record<TaskPriority, TaskPriorityConfig> = {
  high: {
    label: 'High',
    icon: ArrowUp,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-300',
  },
  normal: {
    label: 'Normal',
    icon: Minus,
    color: 'text-slate-600',
    bgColor: 'bg-slate-100',
    borderColor: 'border-slate-300',
  },
  low: {
    label: 'Low',
    icon: ArrowDown,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-300',
  },
};

export function getTaskPriorityConfig(priority: TaskPriority): TaskPriorityConfig {
  return taskPriorityConfigs[priority] || taskPriorityConfigs.normal;
}

// Task Status Configuration
export interface TaskStatusConfig {
  label: string;
  color: string;
  bgColor: string;
  dotColor: string;
}

export const taskStatusConfigs: Record<TaskStatus, TaskStatusConfig> = {
  queued: {
    label: 'Queued',
    color: 'text-slate-600',
    bgColor: 'bg-slate-100',
    dotColor: 'bg-slate-400',
  },
  assigned: {
    label: 'Assigned',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    dotColor: 'bg-blue-500',
  },
  completed: {
    label: 'Completed',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    dotColor: 'bg-green-500',
  },
  failed: {
    label: 'Failed',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    dotColor: 'bg-red-500',
  },
};

export function getTaskStatusConfig(status: TaskStatus): TaskStatusConfig {
  return taskStatusConfigs[status] || taskStatusConfigs.queued;
}

// Phase Configuration for Progress Indicator
export interface PhaseConfig {
  label: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
}

export const phaseConfigs: Record<FailurePhase, PhaseConfig> = {
  classification: {
    label: 'Classify',
    icon: Tag,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
  },
  inspection: {
    label: 'Inspect',
    icon: Search,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  fix_generation: {
    label: 'Fix',
    icon: Wrench,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
  },
  validation: {
    label: 'Validate',
    icon: CheckSquare,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
};

export const phaseOrder: FailurePhase[] = ['classification', 'inspection', 'fix_generation', 'validation'];

export function getPhaseConfig(phase: FailurePhase): PhaseConfig {
  return phaseConfigs[phase] || phaseConfigs.classification;
}

export function getPhaseIndex(phase: FailurePhase): number {
  return phaseOrder.indexOf(phase);
}

export function formatTaskDuration(createdAt: string): string {
  const created = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);

  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}
