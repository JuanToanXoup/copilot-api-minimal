import { memo, useState, useCallback, useMemo } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Circle,
  ChevronDown,
  ChevronUp,
  FileText,
  Settings2,
  Plug,
} from 'lucide-react';
import clsx from 'clsx';
import { useStore } from '../store';
import type { PromptBlockNodeData } from '../types';

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

interface PromptBlockNodeProps {
  id: string;
  data: PromptBlockNodeData;
  selected?: boolean;
}

function PromptBlockNode({ id, data, selected }: PromptBlockNodeProps) {
  const { setNodes } = useReactFlow();
  const [isExpanded, setIsExpanded] = useState(true);

  // Get source of truth from store
  const agents = useStore((state) => state.agents);
  const promptTemplates = useStore((state) => state.promptTemplates);

  const {
    label,
    agentId,
    promptTemplateId,
    status,
    resolvedPrompt,
    response,
  } = data;

  // Resolve references to actual objects
  const selectedAgent = useMemo(
    () => agents.find((a) => a.instance_id === agentId),
    [agents, agentId]
  );
  const selectedTemplate = useMemo(
    () => promptTemplates.find((t) => t.id === promptTemplateId),
    [promptTemplates, promptTemplateId]
  );

  // Extract variables from the selected template
  const templateVariables = useMemo(
    () => extractVariables(selectedTemplate?.template || ''),
    [selectedTemplate?.template]
  );

  // Update node data helper
  const updateNodeData = useCallback(
    (updates: Partial<PromptBlockNodeData>) => {
      setNodes((nodes) =>
        nodes.map((node) =>
          node.id === id ? { ...node, data: { ...node.data, ...updates } } : node
        )
      );
    },
    [id, setNodes]
  );

  // Handle agent selection
  const handleAgentChange = useCallback(
    (instanceId: string) => {
      updateNodeData({ agentId: instanceId || null });
    },
    [updateNodeData]
  );

  // Handle template selection
  const handleTemplateChange = useCallback(
    (templateId: string) => {
      updateNodeData({
        promptTemplateId: templateId || null,
        // Reset variable bindings when template changes
        variableBindings: [],
      });
    },
    [updateNodeData]
  );


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

  // Get display name for agent
  const getAgentDisplayName = (agent: typeof selectedAgent) => {
    if (!agent) return '';
    return agent.role || (agent.agent_name !== 'Default Agent' ? agent.agent_name : null) || agent.project_name || 'Agent';
  };

  return (
    <div
      className={clsx(
        'rounded-lg shadow-md border-2 w-[400px] transition-all',
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
            onChange={(e) => updateNodeData({ label: e.target.value })}
            className="font-semibold text-slate-700 text-sm bg-transparent border-none outline-none min-w-0 flex-1 nodrag"
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

      {/* Agent Selector - like Postman's "Select Request" */}
      <div className="px-3 py-2 border-b bg-slate-50">
        <div className="flex items-center gap-2 mb-2">
          <Plug className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
            Agent
          </span>
        </div>
        <select
          value={agentId || ''}
          onChange={(e) => handleAgentChange(e.target.value)}
          onMouseDown={(e) => e.stopPropagation()}
          className={clsx(
            'w-full px-2 py-1.5 rounded text-sm font-medium nodrag',
            'border focus:outline-none focus:ring-2 focus:ring-indigo-400',
            selectedAgent?.connected
              ? 'bg-green-50 border-green-300 text-green-700'
              : agentId
                ? 'bg-amber-50 border-amber-300 text-amber-700'
                : 'bg-white border-slate-200 text-slate-600'
          )}
        >
          <option value="">Select agent...</option>
          {agents.map((agent) => (
            <option key={agent.instance_id} value={agent.instance_id}>
              :{agent.port} - {getAgentDisplayName(agent)}
              {!agent.connected && ' (disconnected)'}
            </option>
          ))}
        </select>
      </div>

      {/* Prompt Template Selector - like Postman's Request Selection */}
      <div className="px-3 py-2 border-b bg-slate-50">
        <div className="flex items-center gap-2 mb-2">
          <Settings2 className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
            Prompt Template
          </span>
        </div>
        <select
          value={promptTemplateId || ''}
          onChange={(e) => handleTemplateChange(e.target.value)}
          onMouseDown={(e) => e.stopPropagation()}
          className="w-full px-2 py-1.5 rounded text-sm border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 nodrag"
        >
          <option value="">Select template...</option>
          {promptTemplates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
        {selectedTemplate?.description && (
          <p className="text-[10px] text-slate-400 mt-1">{selectedTemplate.description}</p>
        )}
      </div>

      {isExpanded && selectedTemplate && (
        <>
          {/* Template Preview */}
          <div className="px-3 py-2 border-b">
            <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1">
              Template
            </div>
            <div className="text-xs text-slate-600 bg-slate-50 rounded p-2 font-mono whitespace-pre-wrap max-h-24 overflow-y-auto nodrag nowheel">
              {selectedTemplate.template}
            </div>
          </div>

          {/* Variable Bindings - Auto-generated from template variables */}
          {templateVariables.length > 0 && (
            <div className="px-3 py-2 border-b">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
                  Variables
                </span>
                <span className="text-[9px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded">
                  auto-resolves
                </span>
              </div>
              <div className="space-y-2">
                {templateVariables.map((varName) => {
                  const isInputVar = varName === 'input';
                  return (
                    <div key={varName} className="flex items-center gap-2">
                      <span className="text-xs font-mono text-indigo-600 min-w-[80px]">
                        {`{{${varName}}}`}
                      </span>
                      {isInputVar ? (
                        <span className="flex-1 text-[10px] px-1.5 py-1 rounded bg-blue-50 text-blue-600 border border-blue-200">
                          ← Workflow input
                        </span>
                      ) : (
                        <span className="flex-1 text-[10px] px-1.5 py-1 rounded bg-green-50 text-green-600 border border-green-200">
                          ← Auto from upstream
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Output Extraction Info */}
          {selectedTemplate.outputExtraction && (
            <div className="px-3 py-2 border-b bg-green-50">
              <div className="text-[10px] font-medium text-green-700 uppercase tracking-wide mb-1">
                Output: {selectedTemplate.outputExtraction.outputName}
              </div>
              <div className="text-[10px] text-green-600">
                Mode: {selectedTemplate.outputExtraction.mode}
                {selectedTemplate.outputExtraction.pattern && ` | Pattern: ${selectedTemplate.outputExtraction.pattern}`}
              </div>
            </div>
          )}

          {/* Resolved Prompt (runtime) */}
          {resolvedPrompt && (
            <div className="px-3 py-2 border-t bg-blue-50">
              <div className="text-[10px] font-medium text-blue-600 uppercase tracking-wide mb-1">
                Resolved Prompt
              </div>
              <div className="text-xs text-slate-700 bg-white rounded p-2 border border-blue-200 font-mono max-h-20 overflow-y-auto nodrag nowheel">
                {resolvedPrompt}
              </div>
            </div>
          )}

          {/* Response (runtime) */}
          {response && (
            <div className="px-3 py-2 border-t">
              <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1">
                Response
              </div>
              <div
                className={clsx(
                  'text-xs rounded p-2 border font-mono max-h-32 overflow-y-auto nodrag nowheel',
                  status === 'error'
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : 'bg-green-50 text-slate-700 border-green-200'
                )}
              >
                {response}
              </div>
            </div>
          )}
        </>
      )}

      {/* Collapsed state */}
      {!isExpanded && (
        <div className="px-3 py-2 text-xs text-slate-500">
          {selectedTemplate ? (
            <span className="font-mono">{selectedTemplate.name}</span>
          ) : (
            <span className="text-slate-400">No template selected</span>
          )}
          {selectedAgent && (
            <span className="ml-2 text-slate-400">
              → :{selectedAgent.port}
            </span>
          )}
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
