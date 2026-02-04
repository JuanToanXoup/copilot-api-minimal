import { Loader2, CheckCircle2, XCircle, Circle } from 'lucide-react';

export type NodeStatus = 'idle' | 'waiting' | 'running' | 'success' | 'error';

interface StatusIconProps {
  status: NodeStatus;
}

export default function StatusIcon({ status }: StatusIconProps) {
  switch (status) {
    case 'running':
      return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
    case 'success':
      return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case 'error':
      return <XCircle className="w-4 h-4 text-red-500" />;
    case 'waiting':
      return <Circle className="w-4 h-4 text-amber-500 animate-pulse" />;
    default:
      return <Circle className="w-4 h-4 text-slate-300" />;
  }
}

export const statusColors: Record<NodeStatus, string> = {
  idle: 'border-slate-200 bg-white',
  waiting: 'border-amber-300 bg-amber-50',
  running: 'border-blue-400 bg-blue-50',
  success: 'border-green-400 bg-green-50',
  error: 'border-red-400 bg-red-50',
};
