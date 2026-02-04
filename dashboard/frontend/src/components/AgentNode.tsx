import { memo, useState, useCallback } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Loader2, CheckCircle2, XCircle, Circle, ChevronDown, ChevronUp, Code, FileJson, FileText, FileCode, Maximize2, Minimize2, Server } from 'lucide-react';
import clsx from 'clsx';
import type { Agent } from '../types';
import { getAgentLabel } from '../utils/agentNaming';
import { getUserFriendlyError, isErrorResponse } from '../utils/errorMessages';

// Output type options
const outputTypes = [
  { value: 'text', label: 'Text', icon: FileText, color: 'bg-slate-100 text-slate-700', description: 'Plain text response' },
  { value: 'code', label: 'Code', icon: Code, color: 'bg-blue-100 text-blue-700', description: 'Source code output' },
  { value: 'json', label: 'JSON', icon: FileJson, color: 'bg-green-100 text-green-700', description: 'Structured JSON data' },
  { value: 'markdown', label: 'Markdown', icon: FileCode, color: 'bg-purple-100 text-purple-700', description: 'Formatted markdown' },
];

interface AgentNodeData {
  label: string;
  agent: Agent | null;
  status: 'idle' | 'waiting' | 'running' | 'success' | 'error';
  prompt?: string;
  response?: string;
  // Configurable fields
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
  const { agent, status, prompt, response, outputType, outputSchema } = data;
  const { setNodes } = useReactFlow();
  const [isExpanded, setIsExpanded] = useState(true); // Default to expanded to show config
  const [isResponseExpanded, setIsResponseExpanded] = useState(false);
  const [showOutputTypeDropdown, setShowOutputTypeDropdown] = useState(false);
  const [showSchemaEditor, setShowSchemaEditor] = useState(false);

  const selectedOutputType = outputTypes.find(t => t.value === outputType) || outputTypes[0];
  const OutputIcon = selectedOutputType.icon;

  const displayName = agent ? getAgentLabel(agent) : data.label || 'Agent';

  // Process error response for user-friendly display
  const hasError = status === 'error' || (response && isErrorResponse(response));
  const friendlyError = hasError && response ? getUserFriendlyError(response) : null;

  // Update node data
  const updateNodeData = useCallback((updates: Partial<AgentNodeData>) => {
    setNodes(nodes => nodes.map(node => {
      if (node.id === id) {
        return { ...node, data: { ...node.data, ...updates } };
      }
      return node;
    }));
  }, [id, setNodes]);

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
    error: 'border-red-400 bg-red-50 ring-2 ring-red-300 ring-offset-1',
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
      'rounded-lg shadow-md border-2 w-[370px] transition-all',
      statusColors[status]
    )}>
      {/* Header */}
      <div className={clsx(
        'px-3 py-2 border-b flex items-center justify-between',
        hasError ? 'bg-red-50' : 'bg-white'
      )}>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Server className="w-4 h-4 flex-shrink-0 text-blue-500" />
          <span className="font-semibold text-slate-700 text-sm truncate">
            {displayName}
          </span>
          {agent?.connected && (
            <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" title="Connected" />
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
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
                  {hasError ? 'Error' : 'Output'}
                </div>
                <div className="flex items-center gap-1">
                  <span className={clsx('px-1 py-0.5 rounded text-[9px] font-medium flex items-center gap-0.5', selectedOutputType.color)}>
                    <OutputIcon className="w-2.5 h-2.5" />
                    {selectedOutputType.label}
                  </span>
                  <button
                    onClick={() => setIsResponseExpanded(!isResponseExpanded)}
                    className="p-0.5 hover:bg-slate-100 rounded"
                    title={isResponseExpanded ? 'Collapse' : 'Expand'}
                  >
                    {isResponseExpanded ? (
                      <Minimize2 className="w-3 h-3 text-slate-400" />
                    ) : (
                      <Maximize2 className="w-3 h-3 text-slate-400" />
                    )}
                  </button>
                </div>
              </div>

              {/* Error display with friendly message */}
              {hasError && friendlyError ? (
                <div className="rounded border border-red-200 bg-red-50 overflow-hidden">
                  <div className="px-2 py-1.5 border-b border-red-200 bg-red-100">
                    <span className="text-xs font-medium text-red-700">{friendlyError.title}</span>
                  </div>
                  <div className="px-2 py-1.5">
                    <p className="text-xs text-red-700">{friendlyError.message}</p>
                    <p className="text-[10px] text-red-500 mt-1">{friendlyError.suggestion}</p>
                  </div>
                  {isResponseExpanded && (
                    <div className="px-2 py-1.5 border-t border-red-200 bg-red-50">
                      <p className="text-[10px] font-mono text-red-600 whitespace-pre-wrap break-words">
                        {decodeHtml(response)}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className={clsx(
                  'text-xs rounded p-2 border nodrag nowheel',
                  'bg-green-50 text-slate-700 border-green-200',
                  outputType === 'code' && 'font-mono text-[10px]',
                  isResponseExpanded ? 'max-h-[300px] overflow-y-auto whitespace-pre-wrap break-words' : 'line-clamp-4'
                )}>
                  {decodeHtml(response)}
                </div>
              )}
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
        <div
          className="px-3 py-2 cursor-pointer hover:bg-slate-50 transition-colors"
          onClick={() => setIsExpanded(true)}
        >
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <span className={clsx('px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5', selectedOutputType.color)}>
              <OutputIcon className="w-2.5 h-2.5" />
              {selectedOutputType.label}
            </span>
            {hasError && (
              <span className="px-1.5 py-0.5 rounded font-medium bg-red-100 text-red-700">
                Error
              </span>
            )}
          </div>
          <div className="text-[9px] text-slate-400 mt-1 flex items-center gap-1">
            <ChevronDown className="w-3 h-3" />
            Click to configure output & schema
          </div>
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
