import { memo, useState, useRef, useEffect } from 'react';
import {
  Globe,
  GitBranch,
  Split,
  Layers,
  CheckCircle,
  FileOutput,
  Play,
  FileText,
  Plus,
  ChevronDown,
} from 'lucide-react';
import clsx from 'clsx';

interface NodeTypeConfig {
  type: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  description: string;
  defaultData: Record<string, unknown>;
}

const nodeTypeConfigs: NodeTypeConfig[] = [
  {
    type: 'workflowStart',
    label: 'Start',
    icon: Play,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 hover:bg-blue-100 border-blue-200',
    description: 'Workflow entry point with input',
    defaultData: {
      label: 'Start',
    },
  },
  {
    type: 'promptBlock',
    label: 'Prompt Block',
    icon: FileText,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200',
    description: 'Execute prompt via template + agent',
    defaultData: {
      label: 'Prompt Block',
      agentId: null,
      promptTemplateId: null,
      variableBindings: [],
      inputs: [], // Declared inputs for scoped context
      status: 'idle',
    },
  },
  {
    type: 'httpRequest',
    label: 'HTTP Request',
    icon: Globe,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50 hover:bg-cyan-100 border-cyan-200',
    description: 'Make HTTP API calls',
    defaultData: {
      label: 'HTTP Request',
      status: 'idle',
      method: 'GET',
      url: '',
      headers: {},
      body: '',
    },
  },
  {
    type: 'condition',
    label: 'Condition',
    icon: GitBranch,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 hover:bg-amber-100 border-amber-200',
    description: 'If/else branching',
    defaultData: {
      label: 'Condition',
      status: 'idle',
      condition: '',
    },
  },
  {
    type: 'router',
    label: 'Router',
    icon: Split,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 hover:bg-purple-100 border-purple-200',
    description: 'Route to different paths',
    defaultData: {
      label: 'Router',
      status: 'idle',
      routes: ['Route 1', 'Route 2'],
    },
  },
  {
    type: 'aggregator',
    label: 'Aggregator',
    icon: Layers,
    color: 'text-teal-600',
    bgColor: 'bg-teal-50 hover:bg-teal-100 border-teal-200',
    description: 'Combine multiple outputs',
    defaultData: {
      label: 'Aggregator',
      status: 'idle',
      inputs: [],
    },
  },
  {
    type: 'evaluator',
    label: 'Evaluator',
    icon: CheckCircle,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200',
    description: 'Evaluate and approve/reject',
    defaultData: {
      label: 'Evaluator',
      status: 'idle',
      iteration: 0,
      maxIterations: 3,
    },
  },
  {
    type: 'output',
    label: 'Output',
    icon: FileOutput,
    color: 'text-slate-600',
    bgColor: 'bg-slate-50 hover:bg-slate-100 border-slate-200',
    description: 'Collect final results',
    defaultData: {
      label: 'Output',
      results: [],
      status: 'idle',
    },
  },
];

interface NodePaletteProps {
  onAddNode: (type: string, data: Record<string, unknown>) => void;
}

function NodePalette({ onAddNode }: NodePaletteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleDragStart = (
    event: React.DragEvent,
    nodeType: string,
    defaultData: Record<string, unknown>
  ) => {
    event.dataTransfer.setData(
      'application/reactflow-node',
      JSON.stringify({ type: nodeType, data: defaultData })
    );
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleAddNode = (type: string, data: Record<string, unknown>) => {
    onAddNode(type, data);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-sm',
          'hover:border-emerald-400 hover:bg-emerald-50',
          isOpen ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-white'
        )}
      >
        <Plus className="w-4 h-4 text-emerald-500" />
        <span className="text-slate-700 font-medium">Add Node</span>
        <ChevronDown className={clsx(
          'w-4 h-4 text-slate-400 transition-transform',
          isOpen && 'rotate-180'
        )} />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-slate-200 rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
              Node Types
            </span>
          </div>
          <div className="p-2 space-y-1">
            {nodeTypeConfigs.map((config) => {
              const Icon = config.icon;
              return (
                <button
                  key={config.type}
                  draggable
                  onDragStart={(e) => handleDragStart(e, config.type, config.defaultData)}
                  onClick={() => handleAddNode(config.type, config.defaultData)}
                  className={clsx(
                    'w-full text-left px-3 py-2 rounded-lg transition-all cursor-grab active:cursor-grabbing',
                    'hover:bg-slate-50 border border-transparent hover:border-slate-200'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={clsx('p-1.5 rounded-md border', config.bgColor)}>
                      <Icon className={clsx('w-4 h-4', config.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-700">
                        {config.label}
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        {config.description}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="p-2 border-t border-slate-100 bg-slate-50">
            <p className="text-[10px] text-slate-400">
              Click to add or drag onto canvas
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(NodePalette);
