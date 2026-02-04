import { useState } from 'react';
import { Bot, Circle, Plus, X, FolderOpen, Play } from 'lucide-react';
import clsx from 'clsx';
import type { Agent } from '../types';
import { getAgentLabel, formatProjectName } from '../utils/agentNaming';
import { useStore } from '../store';

interface SidebarProps {
  agents: Agent[];
  onDragStart: (event: React.DragEvent, agent: Agent) => void;
  onSpawnAgent?: (projectPath: string) => void;
}

export default function Sidebar({ agents, onDragStart, onSpawnAgent }: SidebarProps) {
  const { setActiveProjectPath } = useStore();
  const [showNewAgentModal, setShowNewAgentModal] = useState(false);
  const [newAgentPath, setNewAgentPath] = useState('');
  const [isSpawning, setIsSpawning] = useState(false);
  const [setAsActiveProject, setSetAsActiveProject] = useState(true);

  const connectedAgents = agents.filter(a => a.connected);
  const disconnectedAgents = agents.filter(a => !a.connected);

  const handleSpawn = async () => {
    if (!newAgentPath.trim() || !onSpawnAgent) return;

    setIsSpawning(true);
    try {
      const projectPath = newAgentPath.trim();
      onSpawnAgent(projectPath);

      // Auto-set as active project if checkbox is checked
      if (setAsActiveProject) {
        setActiveProjectPath(projectPath);
      }

      setShowNewAgentModal(false);
      setNewAgentPath('');
    } finally {
      setIsSpawning(false);
    }
  };

  const AgentCard = ({ agent }: { agent: Agent }) => {
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
  };

  return (
    <>
      {/* Header */}
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <Play className="w-4 h-4" />
            Available Agents
          </h2>
          <button
            onClick={() => setShowNewAgentModal(true)}
            className="p-1.5 rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-colors"
            title="Add New Agent"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Drag agents onto the canvas to build your workflow
        </p>
      </div>

      {/* Connected Agents */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {connectedAgents.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Connected ({connectedAgents.length})
            </h3>
            <div className="space-y-2">
              {connectedAgents.map((agent) => (
                <AgentCard key={agent.instance_id} agent={agent} />
              ))}
            </div>
          </div>
        )}

        {disconnectedAgents.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
              Disconnected ({disconnectedAgents.length})
            </h3>
            <div className="space-y-2 opacity-60">
              {disconnectedAgents.map((agent) => (
                <AgentCard key={agent.instance_id} agent={agent} />
              ))}
            </div>
          </div>
        )}

        {agents.length === 0 && (
          <div className="text-center py-8 text-slate-400 text-sm">
            No agents registered.
            <br />
            <button
              onClick={() => setShowNewAgentModal(true)}
              className="text-blue-500 hover:text-blue-600 mt-2"
            >
              Add your first agent
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-200 bg-slate-50">
        <div className="text-xs text-slate-500">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span>Connected & ready</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span>Disconnected</span>
          </div>
        </div>
      </div>

      {/* New Agent Modal */}
      {showNewAgentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-[440px] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <Bot className="w-5 h-5 text-blue-500" />
                Add New Agent
              </h3>
              <button
                onClick={() => setShowNewAgentModal(false)}
                className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-4 space-y-4">
              {/* Project Path */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Project Folder
                </label>
                <div className="relative">
                  <FolderOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={newAgentPath}
                    onChange={(e) => setNewAgentPath(e.target.value)}
                    placeholder="/path/to/your/project"
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Full path to the project folder to open in IntelliJ
                </p>
              </div>

              {/* Set as Active Project */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={setAsActiveProject}
                  onChange={(e) => setSetAsActiveProject(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-500 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700">Set as active project context</span>
              </label>
              <p className="text-xs text-slate-500 -mt-2 ml-6">
                Workflows and prompts will be saved to this project's .citi-agent folder
              </p>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setShowNewAgentModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSpawn}
                disabled={!newAgentPath.trim() || isSpawning}
                className={clsx(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  newAgentPath.trim() && !isSpawning
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                )}
              >
                {isSpawning ? 'Launching...' : 'Launch Agent'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
