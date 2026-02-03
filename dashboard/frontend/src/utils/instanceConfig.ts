import { Server, Loader2, CheckCircle2, Clock, XCircle, type LucideIcon } from 'lucide-react';
import type { Instance } from '../types';

export interface InstanceStatusConfig {
  label: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  borderColor: string;
  dotColor: string;
}

export const instanceStatusConfigs: Record<Instance['status'], InstanceStatusConfig> = {
  spawning: {
    label: 'Spawning',
    icon: Loader2,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-300',
    dotColor: 'bg-gray-400',
  },
  available: {
    label: 'Available',
    icon: CheckCircle2,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-400',
    dotColor: 'bg-green-500',
  },
  busy: {
    label: 'Busy',
    icon: Server,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-400',
    dotColor: 'bg-blue-500',
  },
  idle: {
    label: 'Idle',
    icon: Clock,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    borderColor: 'border-yellow-400',
    dotColor: 'bg-yellow-500',
  },
  terminated: {
    label: 'Terminated',
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-400',
    dotColor: 'bg-red-500',
  },
};

export function getInstanceStatusConfig(status: Instance['status']): InstanceStatusConfig {
  return instanceStatusConfigs[status] || instanceStatusConfigs.available;
}

export function formatInstanceUptime(startedAt: string): string {
  const start = new Date(startedAt);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export function formatIdleTime(idleSince: string | undefined): string {
  if (!idleSince) return '-';

  const idle = new Date(idleSince);
  const now = new Date();
  const diffMs = now.getTime() - idle.getTime();

  const minutes = Math.floor(diffMs / (1000 * 60));
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

export function calculatePoolUtilization(instances: Instance[]): {
  total: number;
  available: number;
  busy: number;
  idle: number;
  utilizationPercent: number;
} {
  const total = instances.filter(i => i.status !== 'terminated').length;
  const available = instances.filter(i => i.status === 'available').length;
  const busy = instances.filter(i => i.status === 'busy').length;
  const idle = instances.filter(i => i.status === 'idle').length;

  const utilizationPercent = total > 0 ? Math.round((busy / total) * 100) : 0;

  return { total, available, busy, idle, utilizationPercent };
}
