import { memo, useState, useCallback } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Circle,
  ChevronDown,
  ChevronUp,
  FileText,
  Variable,
  Braces,
  Maximize2,
  Minimize2,
  AlertCircle,
} from 'lucide-react';
import clsx from 'clsx';
import type { Agent } from '../types';

// Variable extraction modes
export type ExtractionMode = 'full' | 'json' | 'jsonpath' | 'regex' | 'first_line';

export interface VariableBinding {
  name: string; // The {{variable}} name in the template
  source: 'input' | 'upstream' | 'static'; // Where the value comes from
  sourceNodeId?: string; // If upstream, which node
  sourcePath?: string; // JSON path or extraction pattern
  staticValue?: string; // If static, the fixed value
}

export interface OutputExtraction {
  mode: ExtractionMode;
  pattern?: string; // For regex or jsonpath
  outputName: string; // Name to expose to downstream nodes
}

export interface PromptBlockData {
  label: string;
  promptTemplate: string; // The prompt with {{variables}}
  variableBindings: VariableBinding[];
  outputExtractions: OutputExtraction[];
  agent: Agent | null;
  port?: number; // Manually specified port (overrides agent.port)
  status: 'idle' | 'waiting' | 'running' | 'success' | 'error';
  prompt?: string; // Resolved prompt at runtime
  response?: string; // Response from agent
  extractedOutputs?: Record<string, unknown>; // Extracted values
}

interface PromptBlockNodeProps {
  id: string;
  data: PromptBlockData;
  selected?: boolean;
}

// Extract {{variable}} names from template
export function extractVariables(template: string): string[] {
  const regex = /\{\{(\w+)\}\}/g;
  const variables: string[] = [];
  let match;
  while ((match = regex.exec(template)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1]);
    }
  }
  return variables;
}

function PromptBlockNode({ id, data, selected }: PromptBlockNodeProps) {
  const { setNodes } = useReactFlow();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isResponseExpanded, setIsResponseExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'template' | 'variables' | 'output'>('template');

  const {
    label,
    promptTemplate,
    variableBindings,
    outputExtractions,
    agent,
    port: manualPort,
    status,
    prompt,
    response,
  } = data;

  // Effective port: manual port takes precedence over agent port
  const effectivePort = manualPort || agent?.port;
  const isConnected = agent?.connected && (manualPort ? agent.port === manualPort : true);

  // Extract variables from template
  const templateVariables = extractVariables(promptTemplate || '');
  const unboundVariables = templateVariables.filter(
    (v) => !variableBindings.some((b) => b.name === v)
  );

  // Update node data
  const updateNodeData = useCallback(
    (updates: Partial<PromptBlockData>) => {
      setNodes((nodes) =>
        nodes.map((node) => {
          if (node.id === id) {
            return { ...node, data: { ...node.data, ...updates } };
          }
          return node;
        })
      );
    },
    [id, setNodes]
  );

  const handleTemplateChange = (value: string) => {
    updateNodeData({ promptTemplate: value });
  };

  const handleLabelChange = (value: string) => {
    updateNodeData({ label: value });
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

  return (
    <div
      className={clsx(
        'rounded-lg shadow-md border-2 w-[420px] transition-all',
        statusColors[status],
        selected && 'ring-2 ring-indigo-500 ring-offset-2'
      )}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b flex items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <FileText className="w-4 h-4 text-indigo-600 flex-shrink-0" />
          <input
            type="text"
            value={label}
            onChange={(e) => handleLabelChange(e.target.value)}
            className="font-semibold text-slate-700 text-sm bg-transparent border-none outline-none min-w-0 flex-1"
            placeholder="Block name..."
          />
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <StatusIcon />
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-0.5 hover:bg-white/50 rounded"
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>
        </div>
      </div>

      {/* Instance/Port - Always visible, editable */}
      <div className="px-3 py-1.5 border-b bg-slate-50 flex items-center justify-between">
        <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
          Port
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 text-xs">:</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={effectivePort || ''}
            onChange={(e) => {
              const value = e.target.value ? parseInt(e.target.value, 10) : undefined;
              if (e.target.value === '' || !isNaN(value as number)) {
                updateNodeData({ port: value });
              }
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            onFocus={(e) => e.target.select()}
            placeholder="63342"
            className={clsx(
              'w-16 px-1.5 py-0.5 rounded text-xs font-bold text-center',
              'nodrag nowheel nopan',
              'border focus:outline-none focus:ring-1',
              effectivePort
                ? isConnected
                  ? 'bg-green-100 text-green-700 border-green-300 focus:ring-green-400'
                  : 'bg-amber-100 text-amber-700 border-amber-300 focus:ring-amber-400'
                : 'bg-white text-slate-600 border-slate-300 focus:ring-indigo-400'
            )}
          />
          {effectivePort && (
            <span
              className={clsx(
                'w-2 h-2 rounded-full',
                isConnected ? 'bg-green-500' : 'bg-amber-500'
              )}
              title={isConnected ? 'Connected' : 'Port set (connection status unknown)'}
            />
          )}
        </div>
      </div>

      {isExpanded && (
        <>
          {/* Tabs */}
          <div className="flex border-b bg-slate-50">
            <button
              onClick={() => setActiveTab('template')}
              className={clsx(
                'flex-1 px-3 py-1.5 text-xs font-medium transition-colors flex items-center justify-center gap-1',
                activeTab === 'template'
                  ? 'text-indigo-700 border-b-2 border-indigo-500 bg-white'
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              <FileText className="w-3 h-3" />
              Template
            </button>
            <button
              onClick={() => setActiveTab('variables')}
              className={clsx(
                'flex-1 px-3 py-1.5 text-xs font-medium transition-colors flex items-center justify-center gap-1',
                activeTab === 'variables'
                  ? 'text-indigo-700 border-b-2 border-indigo-500 bg-white'
                  : 'text-slate-500 hover:text-slate-700',
                unboundVariables.length > 0 && 'text-amber-600'
              )}
            >
              <Variable className="w-3 h-3" />
              Variables
              {unboundVariables.length > 0 && (
                <span className="px-1 py-0.5 bg-amber-100 text-amber-700 rounded text-[9px]">
                  {unboundVariables.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('output')}
              className={clsx(
                'flex-1 px-3 py-1.5 text-xs font-medium transition-colors flex items-center justify-center gap-1',
                activeTab === 'output'
                  ? 'text-indigo-700 border-b-2 border-indigo-500 bg-white'
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              <Braces className="w-3 h-3" />
              Output
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-3">
            {activeTab === 'template' && (
              <div className="space-y-2">
                <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
                  Prompt Template
                </div>
                <textarea
                  value={promptTemplate || ''}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                  placeholder={`Enter your prompt template...

Use {{variable}} syntax for dynamic values:
- {{input}} - workflow input
- {{previous_output}} - from upstream node
- {{error_message}} - custom variable`}
                  className={clsx(
                    'w-full px-2 py-1.5 text-xs font-mono rounded border nodrag nowheel',
                    'bg-white border-slate-200 placeholder-slate-300',
                    'focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200',
                    'resize-y min-h-[120px] max-h-[300px]'
                  )}
                  rows={6}
                />
                {templateVariables.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {templateVariables.map((v) => {
                      const isBound = variableBindings.some((b) => b.name === v);
                      return (
                        <span
                          key={v}
                          className={clsx(
                            'px-1.5 py-0.5 rounded text-[10px] font-mono',
                            isBound
                              ? 'bg-green-100 text-green-700'
                              : 'bg-amber-100 text-amber-700'
                          )}
                        >
                          {`{{${v}}}`}
                          {!isBound && (
                            <AlertCircle className="w-2.5 h-2.5 inline ml-0.5" />
                          )}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'variables' && (
              <div className="space-y-3">
                <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
                  Variable Bindings
                </div>
                {templateVariables.length === 0 ? (
                  <div className="text-xs text-slate-400 py-4 text-center">
                    No variables in template.
                    <br />
                    <span className="text-[10px]">
                      Use {'{{variable}}'} syntax in your template.
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {templateVariables.map((varName) => {
                      const binding = variableBindings.find((b) => b.name === varName);
                      return (
                        <div
                          key={varName}
                          className="p-2 rounded border border-slate-200 bg-slate-50"
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-mono text-indigo-600">
                              {`{{${varName}}}`}
                            </span>
                            <select
                              value={binding?.source || 'input'}
                              onChange={(e) => {
                                const newBindings = variableBindings.filter(
                                  (b) => b.name !== varName
                                );
                                newBindings.push({
                                  name: varName,
                                  source: e.target.value as 'input' | 'upstream' | 'static',
                                });
                                updateNodeData({ variableBindings: newBindings });
                              }}
                              className="text-[10px] px-1.5 py-0.5 rounded border border-slate-200 bg-white"
                            >
                              <option value="input">From Workflow Input</option>
                              <option value="upstream">From Upstream Node</option>
                              <option value="static">Static Value</option>
                            </select>
                          </div>
                          {binding?.source === 'static' && (
                            <input
                              type="text"
                              value={binding.staticValue || ''}
                              onChange={(e) => {
                                const newBindings = variableBindings.map((b) =>
                                  b.name === varName
                                    ? { ...b, staticValue: e.target.value }
                                    : b
                                );
                                updateNodeData({ variableBindings: newBindings });
                              }}
                              placeholder="Enter static value..."
                              className="w-full text-xs px-2 py-1 rounded border border-slate-200 mt-1"
                            />
                          )}
                          {binding?.source === 'upstream' && (
                            <input
                              type="text"
                              value={binding.sourcePath || ''}
                              onChange={(e) => {
                                const newBindings = variableBindings.map((b) =>
                                  b.name === varName
                                    ? { ...b, sourcePath: e.target.value }
                                    : b
                                );
                                updateNodeData({ variableBindings: newBindings });
                              }}
                              placeholder="JSON path (e.g., $.result) or leave empty for full response"
                              className="w-full text-xs px-2 py-1 rounded border border-slate-200 mt-1 font-mono"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'output' && (
              <div className="space-y-3">
                <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
                  Output Extraction
                </div>
                <div className="space-y-2">
                  {(outputExtractions || []).map((extraction, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded border border-slate-200 bg-slate-50"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <input
                          type="text"
                          value={extraction.outputName}
                          onChange={(e) => {
                            const newExtractions = [...outputExtractions];
                            newExtractions[idx] = {
                              ...extraction,
                              outputName: e.target.value,
                            };
                            updateNodeData({ outputExtractions: newExtractions });
                          }}
                          placeholder="output_name"
                          className="flex-1 text-xs font-mono px-2 py-1 rounded border border-slate-200"
                        />
                        <select
                          value={extraction.mode}
                          onChange={(e) => {
                            const newExtractions = [...outputExtractions];
                            newExtractions[idx] = {
                              ...extraction,
                              mode: e.target.value as ExtractionMode,
                            };
                            updateNodeData({ outputExtractions: newExtractions });
                          }}
                          className="text-[10px] px-1.5 py-1 rounded border border-slate-200 bg-white"
                        >
                          <option value="full">Full Response</option>
                          <option value="json">Parse as JSON</option>
                          <option value="jsonpath">JSON Path</option>
                          <option value="regex">Regex Extract</option>
                          <option value="first_line">First Line</option>
                        </select>
                        <button
                          onClick={() => {
                            const newExtractions = outputExtractions.filter(
                              (_, i) => i !== idx
                            );
                            updateNodeData({ outputExtractions: newExtractions });
                          }}
                          className="text-red-500 hover:text-red-700 p-0.5"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {(extraction.mode === 'jsonpath' || extraction.mode === 'regex') && (
                        <input
                          type="text"
                          value={extraction.pattern || ''}
                          onChange={(e) => {
                            const newExtractions = [...outputExtractions];
                            newExtractions[idx] = {
                              ...extraction,
                              pattern: e.target.value,
                            };
                            updateNodeData({ outputExtractions: newExtractions });
                          }}
                          placeholder={
                            extraction.mode === 'jsonpath'
                              ? '$.result.value'
                              : 'regex pattern with (capture group)'
                          }
                          className="w-full text-xs font-mono px-2 py-1 rounded border border-slate-200"
                        />
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      const newExtractions = [
                        ...(outputExtractions || []),
                        { mode: 'full' as ExtractionMode, outputName: 'output' },
                      ];
                      updateNodeData({ outputExtractions: newExtractions });
                    }}
                    className="w-full py-1.5 text-xs text-indigo-600 hover:text-indigo-700 border border-dashed border-indigo-300 rounded hover:bg-indigo-50 transition-colors"
                  >
                    + Add Output Extraction
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Runtime Input (resolved prompt) */}
          {prompt && (
            <div className="px-3 py-2 border-t bg-blue-50">
              <div className="text-[10px] font-medium text-blue-600 uppercase tracking-wide mb-1">
                Resolved Prompt
              </div>
              <div className="text-xs text-slate-700 line-clamp-3 bg-white rounded p-2 border border-blue-200 font-mono">
                {prompt}
              </div>
            </div>
          )}

          {/* Runtime Output */}
          {response && (
            <div className="px-3 py-2 border-t">
              <div className="flex items-center justify-between mb-1">
                <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
                  Response
                </div>
                <button
                  onClick={() => setIsResponseExpanded(!isResponseExpanded)}
                  className="p-0.5 hover:bg-slate-100 rounded"
                >
                  {isResponseExpanded ? (
                    <Minimize2 className="w-3 h-3 text-slate-400" />
                  ) : (
                    <Maximize2 className="w-3 h-3 text-slate-400" />
                  )}
                </button>
              </div>
              <div
                className={clsx(
                  'text-xs rounded p-2 border nodrag nowheel font-mono',
                  status === 'error'
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : 'bg-green-50 text-slate-700 border-green-200',
                  isResponseExpanded
                    ? 'max-h-[300px] overflow-y-auto whitespace-pre-wrap break-words'
                    : 'line-clamp-3'
                )}
              >
                {response}
              </div>
            </div>
          )}

          {/* Idle state hint */}
          {!prompt && !response && !agent && (
            <div className="px-3 py-3 text-xs text-slate-400 text-center border-t">
              Drag an agent here to assign
            </div>
          )}
        </>
      )}

      {/* Collapsed summary */}
      {!isExpanded && (
        <div
          className="px-3 py-2 cursor-pointer hover:bg-slate-50 transition-colors"
          onClick={() => setIsExpanded(true)}
        >
          <div className="text-[10px] text-slate-500 line-clamp-2 font-mono">
            {promptTemplate?.slice(0, 100) || 'No template defined'}
            {promptTemplate && promptTemplate.length > 100 && '...'}
          </div>
          <div className="flex items-center gap-2 mt-1">
            {templateVariables.length > 0 && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
                {templateVariables.length} vars
              </span>
            )}
            {outputExtractions?.length > 0 && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                {outputExtractions.length} outputs
              </span>
            )}
          </div>
        </div>
      )}

      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-indigo-500 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-indigo-500 border-2 border-white"
      />
    </div>
  );
}

export default memo(PromptBlockNode);
