import { useState, useEffect, useMemo, useRef } from 'react';
import { FolderOpen, ChevronDown, Globe, Check, FolderPlus, Loader2, Plus, Clock, X } from 'lucide-react';
import clsx from 'clsx';
import { useStore } from '../store';
import { getProjectInfo, initProject } from '../services/promptService';

const RECENT_PROJECTS_KEY = 'citi-agent-recent-projects';
const MAX_RECENT = 5;

interface ProjectInfo {
  project_path: string;
  project_name: string;
  has_local_citi_agent: boolean;
  is_using_local: boolean;
  workflows_count: number;
  prompts_count: number;
}

function getRecentProjects(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_PROJECTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function addRecentProject(path: string): void {
  const recent = getRecentProjects().filter(p => p !== path);
  recent.unshift(path);
  localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

function removeRecentProject(path: string): void {
  const recent = getRecentProjects().filter(p => p !== path);
  localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(recent));
}

export default function ProjectSelector() {
  const { agents, activeProjectPath, setActiveProjectPath, addToast } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customPath, setCustomPath] = useState('');
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [recentProjects, setRecentProjects] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load recent projects on mount
  useEffect(() => {
    setRecentProjects(getRecentProjects());
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowCustomInput(false);
        setCustomPath('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Get unique project paths from agents
  const agentProjectPaths = useMemo(() => {
    const paths = new Set<string>();
    agents.forEach(agent => {
      if (agent.project_path) {
        paths.add(agent.project_path);
      }
    });
    return Array.from(paths);
  }, [agents]);

  // Combine agent paths and recent paths, deduplicated
  const allProjectPaths = useMemo(() => {
    const pathSet = new Set([...agentProjectPaths, ...recentProjects]);
    return Array.from(pathSet);
  }, [agentProjectPaths, recentProjects]);

  // Fetch project info when active path changes
  useEffect(() => {
    if (activeProjectPath) {
      setIsLoading(true);
      getProjectInfo(activeProjectPath)
        .then(info => {
          if (!info.error) {
            setProjectInfo(info);
          } else {
            setProjectInfo(null);
          }
        })
        .catch(() => setProjectInfo(null))
        .finally(() => setIsLoading(false));
    } else {
      setProjectInfo(null);
    }
  }, [activeProjectPath]);

  const handleSelectProject = (path: string | null) => {
    if (path) {
      addRecentProject(path);
      setRecentProjects(getRecentProjects());
    }
    setActiveProjectPath(path);
    setIsOpen(false);
    setShowCustomInput(false);
    setCustomPath('');
  };

  const handleCustomSubmit = () => {
    if (customPath.trim()) {
      handleSelectProject(customPath.trim());
    }
  };

  const handleRemoveRecent = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    removeRecentProject(path);
    setRecentProjects(getRecentProjects());
  };

  const handleInitialize = async () => {
    if (!activeProjectPath) return;

    setIsInitializing(true);
    try {
      const result = await initProject(activeProjectPath);
      if (result.error) {
        addToast({ type: 'error', title: 'Failed to initialize', message: result.error });
      } else {
        addToast({ type: 'success', title: 'Project initialized', message: 'Created .citi-agent folder' });
        const info = await getProjectInfo(activeProjectPath);
        if (!info.error) {
          setProjectInfo(info);
        }
      }
    } catch (err) {
      addToast({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Failed to initialize' });
    } finally {
      setIsInitializing(false);
    }
  };

  const displayName = activeProjectPath
    ? activeProjectPath.split('/').pop() || activeProjectPath
    : 'Global';

  const statusText = activeProjectPath && projectInfo
    ? (projectInfo.has_local_citi_agent
        ? `${projectInfo.workflows_count}W / ${projectInfo.prompts_count}P`
        : 'No local')
    : '~/.citi-agent';

  const isAgentProject = (path: string) => agentProjectPaths.includes(path);

  return (
    <div ref={containerRef} className="relative">
      {/* Selector Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-all text-left',
          'hover:border-blue-400 hover:bg-blue-50',
          isOpen ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white'
        )}
      >
        {activeProjectPath ? (
          <FolderOpen className="w-4 h-4 text-blue-500 flex-shrink-0" />
        ) : (
          <Globe className="w-4 h-4 text-slate-400 flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-slate-700 truncate">
            {displayName}
          </div>
        </div>
        <span className={clsx(
          'text-[10px] px-1.5 py-0.5 rounded',
          activeProjectPath && projectInfo?.has_local_citi_agent
            ? 'bg-green-100 text-green-700'
            : activeProjectPath
            ? 'bg-amber-100 text-amber-700'
            : 'bg-slate-100 text-slate-500'
        )}>
          {isLoading ? '...' : statusText}
        </span>
        <ChevronDown className={clsx(
          'w-4 h-4 text-slate-400 transition-transform flex-shrink-0',
          isOpen && 'rotate-180'
        )} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 overflow-hidden min-w-[320px]">
          {/* Initialize option if project lacks local storage */}
          {activeProjectPath && projectInfo && !projectInfo.has_local_citi_agent && (
            <button
              onClick={handleInitialize}
              disabled={isInitializing}
              className="w-full flex items-center gap-2 px-3 py-2 text-left bg-amber-50 hover:bg-amber-100 text-amber-700 border-b border-amber-200"
            >
              {isInitializing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FolderPlus className="w-4 h-4" />
              )}
              <div className="flex-1">
                <span className="text-sm font-medium">Initialize project storage</span>
                <span className="text-[10px] block text-amber-600">Create .citi-agent folder</span>
              </div>
            </button>
          )}

          {/* Global Option */}
          <button
            onClick={() => handleSelectProject(null)}
            className={clsx(
              'w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50',
              !activeProjectPath && 'bg-blue-50'
            )}
          >
            <Globe className="w-4 h-4 text-slate-400" />
            <span className="flex-1 text-sm text-slate-700">Global</span>
            <span className="text-[10px] text-slate-400">~/.citi-agent</span>
            {!activeProjectPath && <Check className="w-4 h-4 text-blue-500" />}
          </button>

          {/* Projects Section */}
          {allProjectPaths.length > 0 && (
            <>
              <div className="border-t border-slate-100 my-1" />
              <div className="px-3 py-1">
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Projects</span>
              </div>
              {allProjectPaths.map(path => {
                const name = path.split('/').pop() || path;
                const isActive = activeProjectPath === path;
                const isFromAgent = isAgentProject(path);
                return (
                  <button
                    key={path}
                    onClick={() => handleSelectProject(path)}
                    className={clsx(
                      'w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 group',
                      isActive && 'bg-blue-50'
                    )}
                  >
                    <FolderOpen className={clsx('w-4 h-4', isFromAgent ? 'text-blue-500' : 'text-slate-400')} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-slate-700 truncate">{name}</span>
                        {isFromAgent && (
                          <span className="text-[9px] px-1 py-0.5 bg-blue-100 text-blue-600 rounded">agent</span>
                        )}
                        {!isFromAgent && (
                          <span className="text-[9px] px-1 py-0.5 bg-slate-100 text-slate-500 rounded flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            recent
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 block truncate">{path}</span>
                    </div>
                    {!isFromAgent && (
                      <button
                        onClick={(e) => handleRemoveRecent(e, path)}
                        className="p-1 opacity-0 group-hover:opacity-100 hover:bg-slate-200 rounded transition-opacity"
                        title="Remove from recent"
                      >
                        <X className="w-3 h-3 text-slate-400" />
                      </button>
                    )}
                    {isActive && <Check className="w-4 h-4 text-blue-500 flex-shrink-0" />}
                  </button>
                );
              })}
            </>
          )}

          {/* Divider */}
          <div className="border-t border-slate-100 my-1" />

          {/* Custom Path Input */}
          {showCustomInput ? (
            <div className="p-3">
              <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wide block mb-1.5">
                Enter project path
              </label>
              <input
                type="text"
                value={customPath}
                onChange={(e) => setCustomPath(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCustomSubmit()}
                placeholder="/Users/you/projects/my-project"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                autoFocus
              />
              <p className="text-[10px] text-slate-400 mt-1.5">
                Tip: Drag a folder from Finder into the input field
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => { setShowCustomInput(false); setCustomPath(''); }}
                  className="flex-1 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCustomSubmit}
                  disabled={!customPath.trim()}
                  className={clsx(
                    'flex-1 px-3 py-1.5 text-sm rounded-lg font-medium',
                    customPath.trim()
                      ? 'bg-blue-500 text-white hover:bg-blue-600'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  )}
                >
                  Select Project
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowCustomInput(true)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 text-slate-600"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm">Add project path...</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
