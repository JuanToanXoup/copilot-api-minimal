import { Plug } from 'lucide-react';
import clsx from 'clsx';
import type { Agent } from '../../types';

interface AgentSelectorProps {
  agents: Agent[];
  selectedAgentId: string | null;
  selectedAgent: Agent | undefined;
  onChange: (instanceId: string) => void;
}

export function getAgentDisplayName(agent: Agent | undefined): string {
  if (!agent) return '';
  return agent.project_name || `:${agent.port}`;
}

export default function AgentSelector({
  agents,
  selectedAgentId,
  selectedAgent,
  onChange,
}: AgentSelectorProps) {
  return (
    <div className="px-3 py-2 border-b bg-slate-50">
      <div className="flex items-center gap-2 mb-2">
        <Plug className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
          Agent
        </span>
      </div>
      <select
        value={selectedAgentId || ''}
        onChange={(e) => onChange(e.target.value)}
        onMouseDown={(e) => e.stopPropagation()}
        className={clsx(
          'w-full px-2 py-1.5 rounded text-sm font-medium nodrag',
          'border focus:outline-none focus:ring-2 focus:ring-indigo-400',
          selectedAgent?.connected
            ? 'bg-green-50 border-green-300 text-green-700'
            : selectedAgentId
              ? 'bg-amber-50 border-amber-300 text-amber-700'
              : 'bg-white border-slate-200 text-slate-600'
        )}
      >
        <option value="">Select agent...</option>
        {agents.map((agent) => (
          <option key={agent.instance_id} value={agent.instance_id}>
            :{agent.port} - {getAgentDisplayName(agent)}
            {!agent.connected && ' (disconnected)'}
          </option>
        ))}
      </select>
    </div>
  );
}
