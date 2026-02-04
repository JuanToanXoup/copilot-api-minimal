import { memo } from 'react';
import {
  Globe,
  GitBranch,
  Split,
  Layers,
  CheckCircle,
  FileOutput,
  Play,
  FileText,
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

  return (
    <div className="flex items-center gap-1">
      {nodeTypeConfigs.map((config) => {
        const Icon = config.icon;
        return (
          <button
            key={config.type}
            draggable
            onDragStart={(e) => handleDragStart(e, config.type, config.defaultData)}
            onClick={() => onAddNode(config.type, config.defaultData)}
            className={clsx(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-grab active:cursor-grabbing',
              config.bgColor,
              config.color
            )}
            title={config.description}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{config.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default memo(NodePalette);
