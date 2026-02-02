import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Bot, Loader2, CheckCircle2, XCircle, Circle } from 'lucide-react';
import clsx from 'clsx';
import type { Agent } from '../types';

interface AgentNodeProps {
  data: {
    label: string;
    agent: Agent | null;
    status: 'idle' | 'waiting' | 'running' | 'success' | 'error';
    response?: string;
  };
}

const roleColors: Record<string, { bg: string; text: string; border: string }> = {
  coder: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300' },
  reviewer: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-300' },
  tester: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-300' },
  default: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-300' },
};

function AgentNode({ data }: AgentNodeProps) {
  const { agent, status, response } = data;
  const role = agent?.role || 'default';
  const colors = roleColors[role] || roleColors.default;

  const StatusIcon = () => {
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
  };

  return (
    <div className={clsx(
      'bg-white rounded-xl shadow-lg border-2 min-w-[280px] overflow-hidden transition-all',
      status === 'running' && 'border-blue-400 shadow-blue-100',
      status === 'success' && 'border-green-400 shadow-green-100',
      status === 'error' && 'border-red-400 shadow-red-100',
      status === 'waiting' && 'border-amber-400 shadow-amber-100',
      status === 'idle' && 'border-slate-200'
    )}>
      {/* Header */}
      <div className={clsx('px-4 py-3 border-b', colors.bg)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className={clsx('w-5 h-5', colors.text)} />
            <span className={clsx('font-semibold', colors.text)}>
              {role.charAt(0).toUpperCase() + role.slice(1)}
            </span>
          </div>
          <StatusIcon />
        </div>
      </div>

      {/* Agent Info */}
      <div className="px-4 py-3 space-y-2">
        {agent ? (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Port</span>
              <span className="font-mono font-medium">{agent.port}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Project</span>
              <span className="font-medium truncate max-w-[140px]">{agent.project_name}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Status</span>
              <span className={clsx(
                'px-2 py-0.5 rounded-full text-xs font-medium',
                agent.connected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              )}>
                {agent.connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            {agent.capabilities.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {agent.capabilities.map((cap) => (
                  <span key={cap} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded">
                    {cap}
                  </span>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="text-sm text-slate-400 text-center py-2">
            No agent assigned
          </div>
        )}
      </div>

      {/* Response Preview */}
      {response && (
        <div className="px-4 py-3 border-t bg-slate-50">
          <div className="text-xs text-slate-500 mb-1">Response</div>
          <div className="text-sm text-slate-700 line-clamp-3 font-mono">
            {response}
          </div>
        </div>
      )}

      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-slate-400 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-slate-400 border-2 border-white"
      />
    </div>
  );
}

export default memo(AgentNode);
