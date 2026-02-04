import { Circle } from 'lucide-react';
import clsx from 'clsx';
import type { Agent } from '../../types';
import { getAgentLabel, formatProjectName } from '../../utils/agentNaming';

interface AgentCardProps {
  agent: Agent;
  onDragStart: (event: React.DragEvent, agent: Agent) => void;
}

export default function AgentCard({ agent, onDragStart }: AgentCardProps) {
  const portLabel = getAgentLabel(agent);
  const projectInfo = formatProjectName(agent.project_path);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, agent)}
      className={clsx(
        'bg-white rounded-lg border-2 p-2 cursor-grab active:cursor-grabbing',
        'hover:shadow-md transition-all border-slate-200',
        'hover:border-blue-400'
      )}
    >
      {/* Port and status */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-mono font-semibold text-sm text-slate-700">
          {portLabel}
        </span>
        <div className="flex items-center gap-1.5">
          <span className={clsx(
            'text-[10px] font-medium px-1.5 py-0.5 rounded',
            agent.connected
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-700'
          )}>
            {agent.connected ? 'Available' : 'Offline'}
          </span>
          <Circle className={clsx(
            'w-2 h-2 flex-shrink-0',
            agent.connected ? 'fill-green-500 text-green-500' : 'fill-red-500 text-red-500'
          )} />
        </div>
      </div>

      {/* Project path with tooltip */}
      <div
        className="text-xs text-slate-500 truncate"
        title={projectInfo.needsTooltip ? projectInfo.full : undefined}
      >
        {projectInfo.display}
      </div>
    </div>
  );
}
