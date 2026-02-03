import { useEffect } from 'react';
import { GitBranch, Activity, Server } from 'lucide-react';
import clsx from 'clsx';
import { useStore } from '../store';
import type { ViewMode } from '../types';

interface ViewModeOption {
  mode: ViewMode;
  label: string;
  icon: typeof GitBranch;
  description: string;
}

const viewModeOptions: ViewModeOption[] = [
  {
    mode: 'workflow',
    label: 'Workflow',
    icon: GitBranch,
    description: 'Build prompt workflows',
  },
  {
    mode: 'agents',
    label: 'Agents',
    icon: Server,
    description: 'Manage connected instances',
  },
  {
    mode: 'monitoring',
    label: 'Monitoring',
    icon: Activity,
    description: 'Monitor self-healing tests',
  },
];

export default function ViewModeToggle() {
  const { viewMode, setViewMode } = useStore();

  // Keyboard shortcuts: Cmd/Ctrl + 1/2/3
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        if (e.key === '1') {
          e.preventDefault();
          setViewMode('workflow');
        } else if (e.key === '2') {
          e.preventDefault();
          setViewMode('agents');
        } else if (e.key === '3') {
          e.preventDefault();
          setViewMode('monitoring');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setViewMode]);

  return (
    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
      {viewModeOptions.map((option, index) => {
        const Icon = option.icon;
        const isActive = viewMode === option.mode;

        return (
          <button
            key={option.mode}
            onClick={() => setViewMode(option.mode)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all',
              isActive
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            )}
            title={`${option.description} (${navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl'}+${index + 1})`}
          >
            <Icon className="w-4 h-4" />
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
