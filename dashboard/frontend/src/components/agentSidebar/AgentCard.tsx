import { Circle } from 'lucide-react';
import clsx from 'clsx';
import type { Agent } from '../../types';
import { getRoleConfig } from '../../utils/roleConfig';
import { getDisplayName, formatProjectName } from '../../utils/agentNaming';

interface AgentCardProps {
  agent: Agent;
  existingNames: string[];
  onDragStart: (event: React.DragEvent, agent: Agent) => void;
}

export default function AgentCard({ agent, existingNames, onDragStart }: AgentCardProps) {
  const roleConfig = getRoleConfig(agent.role);
  const RoleIcon = roleConfig.icon;
  const displayName = getDisplayName(agent, existingNames);
  const projectInfo = formatProjectName(agent.project_path);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, agent)}
      className={clsx(
        'bg-white rounded-lg border-2 p-2 cursor-grab active:cursor-grabbing',
        'hover:shadow-md transition-all',
        roleConfig.borderColor,
        'hover:border-blue-400'
      )}
    >
      {/* Agent name and status */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-semibold text-sm text-slate-700 truncate">
          {displayName}
        </span>
        <Circle className={clsx(
          'w-2 h-2 flex-shrink-0',
          agent.connected ? 'fill-green-500 text-green-500' : 'fill-red-500 text-red-500'
        )} />
      </div>

      {/* Role badge and port */}
      <div className="flex items-center justify-between">
        <span className={clsx(
          'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium',
          roleConfig.bgColor,
          roleConfig.color
        )}>
          <RoleIcon className="w-3 h-3" />
          {roleConfig.label}
        </span>
        <span className="font-mono text-xs text-slate-400">
          :{agent.port}
        </span>
      </div>

      {/* Project path with tooltip */}
      <div
        className="text-xs text-slate-400 mt-1.5 truncate"
        title={projectInfo.needsTooltip ? projectInfo.full : undefined}
      >
        {projectInfo.display}
      </div>
    </div>
  );
}
