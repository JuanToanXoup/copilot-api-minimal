import { memo, useState, useCallback } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Bot, Loader2, CheckCircle2, XCircle, Circle, ChevronDown, ChevronUp, Code, FileJson, FileText, FileCode } from 'lucide-react';
import clsx from 'clsx';
import type { Agent } from '../types';

// Output type options
const outputTypes = [
  { value: 'text', label: 'Text', icon: FileText, color: 'bg-slate-100 text-slate-700', description: 'Plain text response' },
  { value: 'code', label: 'Code', icon: Code, color: 'bg-blue-100 text-blue-700', description: 'Source code output' },
  { value: 'json', label: 'JSON', icon: FileJson, color: 'bg-green-100 text-green-700', description: 'Structured JSON data' },
  { value: 'markdown', label: 'Markdown', icon: FileCode, color: 'bg-purple-100 text-purple-700', description: 'Formatted markdown' },
];

// Role options
const roleOptions = [
  { value: 'coder', label: 'Coder', color: 'bg-blue-100 text-blue-700' },
  { value: 'reviewer', label: 'Reviewer', color: 'bg-purple-100 text-purple-700' },
  { value: 'tester', label: 'Tester', color: 'bg-green-100 text-green-700' },
  { value: 'architect', label: 'Architect', color: 'bg-orange-100 text-orange-700' },
  { value: 'docs', label: 'Docs Writer', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'debugger', label: 'Debugger', color: 'bg-red-100 text-red-700' },
];

interface AgentNodeData {
  label: string;
  agent: Agent | null;
  status: 'idle' | 'waiting' | 'running' | 'success' | 'error';
  prompt?: string;
  response?: string;
  // Configurable fields
  role?: string;
  outputType?: string;
  outputSchema?: string;
}

interface AgentNodeProps {
  id: string;
  data: AgentNodeData;
}

// Decode HTML entities
function decodeHtml(html: string): string {
  const txt = document.createElement('textarea');
  txt.innerHTML = html;
  return txt.value;
}

function AgentNode({ id, data }: AgentNodeProps) {
  const { agent, status, prompt, response, role, outputType, outputSchema } = data;
  const { setNodes } = useReactFlow();
  const [isExpanded, setIsExpanded] = useState(true);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showOutputTypeDropdown, setShowOutputTypeDropdown] = useState(false);
  const [showSchemaEditor, setShowSchemaEditor] = useState(false);

  const selectedRole = roleOptions.find(r => r.value === role) || roleOptions[0];
  const selectedOutputType = outputTypes.find(t => t.value === outputType) || outputTypes[0];
  const OutputIcon = selectedOutputType.icon;

  // Update node data
  const updateNodeData = useCallback((updates: Partial<AgentNodeData>) => {
    setNodes(nodes => nodes.map(node => {
      if (node.id === id) {
        return { ...node, data: { ...node.data, ...updates } };
      }
      return node;
    }));
  }, [id, setNodes]);

  const handleRoleSelect = (value: string) => {
    updateNodeData({ role: value });
    setShowRoleDropdown(false);
  };

  const handleOutputTypeSelect = (value: string) => {
    updateNodeData({ outputType: value });
    setShowOutputTypeDropdown(false);
  };

  const handleSchemaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateNodeData({ outputSchema: e.target.value });
  };

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

  const statusColors = {
    idle: 'border-slate-200 bg-white',
    waiting: 'border-amber-300 bg-amber-50',
    running: 'border-blue-400 bg-blue-50',
    success: 'border-green-400 bg-green-50',
    error: 'border-red-400 bg-red-50',
  };

  // Get schema placeholder based on output type
  const getSchemaPlaceholder = () => {
    switch (outputType) {
      case 'json':
        return `{
  "type": "object",
  "properties": {
    "result": { "type": "string" }
  },
  "required": ["result"]
}`;
      case 'code':
        return `{
  "language": "typescript",
  "hasTests": true,
  "maxLines": 100
}`;
      default:
        return `{
  "minLength": 10,
  "maxLength": 1000,
  "pattern": "optional regex"
}`;
    }
  };

  return (
    <div className={clsx(
      'rounded-lg shadow-md border-2 w-[280px] transition-all',
      statusColors[status]
    )}>
      {/* Header */}
      <div className="px-3 py-2 bg-white border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-slate-600" />
          <span className="font-semibold text-slate-700 text-sm">
            {agent ? `:${agent.port}` : data.label || 'Agent'}
          </span>
          {agent?.connected && (
            <span className="w-2 h-2 rounded-full bg-green-500" title="Connected" />
          )}
        </div>
        <div className="flex items-center gap-1">
          <StatusIcon />
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-0.5 hover:bg-slate-100 rounded"
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>
        </div>
      </div>

      {isExpanded && (
        <>
          {/* Role Selector */}
          <div className="px-3 py-2 border-b bg-slate-50">
            <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
              Role
            </label>
            <div className="relative mt-1">
              <button
                onClick={() => setShowRoleDropdown(!showRoleDropdown)}
                className={clsx(
                  'w-full px-2 py-1.5 text-xs rounded border text-left flex items-center justify-between',
                  'bg-white hover:border-blue-300 transition-colors',
                  showRoleDropdown ? 'border-blue-400 ring-1 ring-blue-200' : 'border-slate-200'
                )}
              >
                <span className={clsx('px-1.5 py-0.5 rounded text-[10px] font-medium', selectedRole.color)}>
                  {selectedRole.label}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>
              {showRoleDropdown && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded shadow-lg max-h-48 overflow-y-auto">
                  {roleOptions.map(option => (
                    <button
                      key={option.value}
                      onClick={() => handleRoleSelect(option.value)}
                      className={clsx(
                        'w-full px-2 py-1.5 text-left hover:bg-slate-50 flex items-center',
                        role === option.value && 'bg-blue-50'
                      )}
                    >
                      <span className={clsx('px-1.5 py-0.5 rounded text-[10px] font-medium', option.color)}>
                        {option.label}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Output Type Selector */}
          <div className="px-3 py-2 border-b bg-slate-50">
            <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
              Expected Output
            </label>
            <div className="relative mt-1">
              <button
                onClick={() => setShowOutputTypeDropdown(!showOutputTypeDropdown)}
                className={clsx(
                  'w-full px-2 py-1.5 text-xs rounded border text-left flex items-center justify-between',
                  'bg-white hover:border-blue-300 transition-colors',
                  showOutputTypeDropdown ? 'border-blue-400 ring-1 ring-blue-200' : 'border-slate-200'
                )}
              >
                <span className={clsx('px-1.5 py-0.5 rounded text-[10px] font-medium flex items-center gap-1', selectedOutputType.color)}>
                  <OutputIcon className="w-3 h-3" />
                  {selectedOutputType.label}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>
              {showOutputTypeDropdown && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded shadow-lg max-h-60 overflow-y-auto">
                  {outputTypes.map(option => {
                    const Icon = option.icon;
                    return (
                      <button
                        key={option.value}
                        onClick={() => handleOutputTypeSelect(option.value)}
                        className={clsx(
                          'w-full px-2 py-1.5 text-left hover:bg-slate-50',
                          outputType === option.value && 'bg-blue-50'
                        )}
                      >
                        <div className={clsx('px-1.5 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 inline-flex', option.color)}>
                          <Icon className="w-3 h-3" />
                          {option.label}
                        </div>
                        <div className="text-[9px] text-slate-400 mt-0.5 pl-1">{option.description}</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Schema Toggle */}
            <button
              onClick={() => setShowSchemaEditor(!showSchemaEditor)}
              className="mt-2 text-[10px] text-blue-500 hover:text-blue-600 flex items-center gap-1"
            >
              <FileJson className="w-3 h-3" />
              {showSchemaEditor ? 'Hide' : 'Add'} Schema
              {outputSchema && !showSchemaEditor && (
                <span className="ml-1 px-1 py-0.5 bg-green-100 text-green-700 rounded text-[9px]">
                  defined
                </span>
              )}
            </button>

            {/* Schema Editor */}
            {showSchemaEditor && (
              <div className="mt-2 nodrag nowheel">
                <textarea
                  value={outputSchema || ''}
                  onChange={handleSchemaChange}
                  placeholder={getSchemaPlaceholder()}
                  className={clsx(
                    'w-full px-2 py-1.5 text-[10px] font-mono rounded border',
                    'bg-white border-slate-200 placeholder-slate-300',
                    'focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200',
                    'resize-y min-h-[80px] max-h-[200px] overflow-y-auto'
                  )}
                  rows={5}
                />
                <div className="text-[9px] text-slate-400 mt-1">
                  JSON schema to validate output format
                </div>
              </div>
            )}
          </div>

          {/* Runtime Input (from workflow execution) */}
          {prompt && (
            <div className="px-3 py-2 border-b">
              <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1">
                Input
              </div>
              <div className="text-xs text-slate-700 line-clamp-2 bg-white rounded p-2 border border-slate-200">
                {prompt}
              </div>
            </div>
          )}

          {/* Runtime Output (from workflow execution) */}
          {response && (
            <div className="px-3 py-2">
              <div className="flex items-center justify-between mb-1">
                <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
                  Output
                </div>
                <span className={clsx('px-1 py-0.5 rounded text-[9px] font-medium flex items-center gap-0.5', selectedOutputType.color)}>
                  <OutputIcon className="w-2.5 h-2.5" />
                  {selectedOutputType.label}
                </span>
              </div>
              <div className={clsx(
                'text-xs line-clamp-4 rounded p-2 border',
                status === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-slate-700 border-green-200',
                outputType === 'code' && 'font-mono text-[10px]'
              )}>
                {decodeHtml(response)}
              </div>
            </div>
          )}

          {/* Idle state - show drop hint */}
          {!prompt && !response && !agent && (
            <div className="px-3 py-3 text-xs text-slate-400 text-center">
              Drag an agent here to assign
            </div>
          )}
        </>
      )}

      {/* Collapsed state summary */}
      {!isExpanded && (
        <div className="px-3 py-1.5 text-[10px] text-slate-500 flex items-center gap-2">
          <span className={clsx('px-1.5 py-0.5 rounded font-medium', selectedRole.color)}>
            {selectedRole.label}
          </span>
          <span className={clsx('px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5', selectedOutputType.color)}>
            <OutputIcon className="w-2.5 h-2.5" />
            {selectedOutputType.label}
          </span>
        </div>
      )}

      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-blue-500 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-blue-500 border-2 border-white"
      />
    </div>
  );
}

export default memo(AgentNode);
