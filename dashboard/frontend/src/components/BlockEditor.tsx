import { useCallback } from 'react';
import { X, Play, FileText, Globe, GitBranch, Split, Layers, CheckCircle, FileOutput } from 'lucide-react';
import clsx from 'clsx';
import { useStore } from '../store';
import type { Node } from '@xyflow/react';
import type { Agent } from '../types';

interface BlockEditorProps {
  node: Node | null;
  onClose: () => void;
  onUpdateNode: (nodeId: string, data: Record<string, unknown>) => void;
}

const nodeTypeConfig: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string; color: string; bgColor: string }> = {
  workflowStart: { icon: Play, label: 'Start', color: 'text-blue-600', bgColor: 'bg-blue-50' },
  promptBlock: { icon: FileText, label: 'Prompt Block', color: 'text-indigo-600', bgColor: 'bg-indigo-50' },
  httpRequest: { icon: Globe, label: 'HTTP Request', color: 'text-cyan-600', bgColor: 'bg-cyan-50' },
  condition: { icon: GitBranch, label: 'Condition', color: 'text-amber-600', bgColor: 'bg-amber-50' },
  router: { icon: Split, label: 'Router', color: 'text-purple-600', bgColor: 'bg-purple-50' },
  aggregator: { icon: Layers, label: 'Aggregator', color: 'text-teal-600', bgColor: 'bg-teal-50' },
  evaluator: { icon: CheckCircle, label: 'Evaluator', color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
  output: { icon: FileOutput, label: 'Output', color: 'text-slate-600', bgColor: 'bg-slate-50' },
};

// Compact input styles
const inputClass = "w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500";
const selectClass = "w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white";
const textareaClass = "w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono resize-none";
const labelClass = "block text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-0.5";

export default function BlockEditor({ node, onClose, onUpdateNode }: BlockEditorProps) {
  const { agents, promptTemplates } = useStore();

  const handleChange = useCallback(
    (field: string, value: unknown) => {
      if (!node) return;
      onUpdateNode(node.id, { [field]: value });
    },
    [node, onUpdateNode]
  );

  if (!node) return null;

  const nodeType = node.type || 'unknown';
  const config = nodeTypeConfig[nodeType] || { icon: FileText, label: nodeType, color: 'text-slate-600', bgColor: 'bg-slate-50' };
  const Icon = config.icon;
  const data = node.data as Record<string, unknown>;

  return (
    <div className="w-[512px] bg-white border border-slate-200 rounded-lg shadow-sm flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className={clsx('px-3 py-2 border-b border-slate-200 flex items-center justify-between', config.bgColor)}>
        <div className="flex items-center gap-1.5">
          <Icon className={clsx('w-4 h-4', config.color)} />
          <span className="font-medium text-sm text-slate-700">{config.label}</span>
        </div>
        <button onClick={onClose} className="p-0.5 rounded hover:bg-white/50 text-slate-400 hover:text-slate-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {/* Common fields */}
        <div>
          <label className={labelClass}>Name</label>
          <input
            type="text"
            value={(data.label as string) || ''}
            onChange={(e) => handleChange('label', e.target.value)}
            placeholder="Name..."
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Description</label>
          <input
            type="text"
            value={(data.description as string) || ''}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="Optional..."
            className={inputClass}
          />
        </div>

        <hr className="border-slate-100" />

        {/* Type-specific fields */}
        {nodeType === 'promptBlock' && (
          <PromptBlockConfig data={data} agents={agents} templates={promptTemplates} onChange={handleChange} />
        )}
        {nodeType === 'httpRequest' && (
          <HttpRequestConfig data={data} onChange={handleChange} />
        )}
        {nodeType === 'condition' && (
          <ConditionConfig data={data} onChange={handleChange} />
        )}
        {nodeType === 'router' && (
          <RouterConfig data={data} onChange={handleChange} />
        )}
        {nodeType === 'aggregator' && (
          <AggregatorConfig data={data} onChange={handleChange} />
        )}
        {nodeType === 'evaluator' && (
          <EvaluatorConfig data={data} onChange={handleChange} />
        )}
        {nodeType === 'workflowStart' && (
          <WorkflowStartConfig />
        )}
        {nodeType === 'output' && (
          <OutputConfig data={data} />
        )}
      </div>
    </div>
  );
}

// === Compact config components ===

function PromptBlockConfig({
  data,
  agents,
  templates,
  onChange
}: {
  data: Record<string, unknown>;
  agents: Agent[];
  templates: Array<{ id: string; name: string }>;
  onChange: (field: string, value: unknown) => void;
}) {
  return (
    <div className="space-y-2">
      <div>
        <label className={labelClass}>Agent</label>
        <select
          value={(data.agentId as string) || ''}
          onChange={(e) => onChange('agentId', e.target.value || null)}
          className={selectClass}
        >
          <option value="">Select...</option>
          {agents.filter(a => a.connected).map((agent) => (
            <option key={agent.instance_id} value={agent.instance_id}>
              :{agent.port} - {agent.project_name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass}>Template</label>
        <select
          value={(data.promptTemplateId as string) || ''}
          onChange={(e) => onChange('promptTemplateId', e.target.value || null)}
          className={selectClass}
        >
          <option value="">Select...</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function HttpRequestConfig({
  data,
  onChange
}: {
  data: Record<string, unknown>;
  onChange: (field: string, value: unknown) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        <div className="w-20">
          <label className={labelClass}>Method</label>
          <select
            value={(data.method as string) || 'GET'}
            onChange={(e) => onChange('method', e.target.value)}
            className={selectClass}
          >
            {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className={labelClass}>URL</label>
          <input
            type="text"
            value={(data.url as string) || ''}
            onChange={(e) => onChange('url', e.target.value)}
            placeholder="https://..."
            className={clsx(inputClass, 'font-mono')}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>Headers (JSON)</label>
        <textarea
          value={typeof data.headers === 'object' ? JSON.stringify(data.headers, null, 2) : '{}'}
          onChange={(e) => {
            try { onChange('headers', JSON.parse(e.target.value)); } catch {}
          }}
          rows={2}
          className={textareaClass}
        />
      </div>

      <div>
        <label className={labelClass}>Body</label>
        <textarea
          value={(data.body as string) || ''}
          onChange={(e) => onChange('body', e.target.value)}
          rows={3}
          className={textareaClass}
        />
      </div>
    </div>
  );
}

function ConditionConfig({
  data,
  onChange
}: {
  data: Record<string, unknown>;
  onChange: (field: string, value: unknown) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        <div className="flex-1">
          <label className={labelClass}>Variable</label>
          <input
            type="text"
            value={(data.variable as string) || '$result'}
            onChange={(e) => onChange('variable', e.target.value)}
            className={clsx(inputClass, 'font-mono')}
          />
        </div>
        <div className="w-16">
          <label className={labelClass}>Op</label>
          <select
            value={(data.operator as string) || '=='}
            onChange={(e) => onChange('operator', e.target.value)}
            className={selectClass}
          >
            {['==', '!=', '>', '<', '>=', '<='].map((op) => (
              <option key={op} value={op}>{op}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className={labelClass}>Value</label>
          <input
            type="text"
            value={(data.value as string) || ''}
            onChange={(e) => onChange('value', e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded p-1.5 text-[10px] font-mono text-amber-700">
        {String(data.variable || '$result')} {String(data.operator || '==')} {String(data.value || 'true')}
      </div>
    </div>
  );
}

function RouterConfig({
  data,
  onChange
}: {
  data: Record<string, unknown>;
  onChange: (field: string, value: unknown) => void;
}) {
  const routes = (data.routes as string[]) || ['Route 1', 'Route 2'];

  const updateRoute = (index: number, value: string) => {
    const newRoutes = [...routes];
    newRoutes[index] = value;
    onChange('routes', newRoutes);
  };

  const addRoute = () => onChange('routes', [...routes, `Route ${routes.length + 1}`]);
  const removeRoute = (index: number) => {
    if (routes.length > 1) onChange('routes', routes.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-1.5">
      <label className={labelClass}>Routes</label>
      {routes.map((route, i) => (
        <div key={i} className="flex items-center gap-1">
          <input
            type="text"
            value={route}
            onChange={(e) => updateRoute(i, e.target.value)}
            className={clsx(inputClass, 'flex-1')}
          />
          <button
            onClick={() => removeRoute(i)}
            className="p-1 text-slate-400 hover:text-red-500"
            disabled={routes.length <= 1}
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
      <button onClick={addRoute} className="text-[10px] text-purple-600 hover:text-purple-700 font-medium">
        + Add
      </button>
    </div>
  );
}

function AggregatorConfig({
  data,
  onChange
}: {
  data: Record<string, unknown>;
  onChange: (field: string, value: unknown) => void;
}) {
  return (
    <div>
      <label className={labelClass}>Mode</label>
      <select
        value={(data.mode as string) || 'all'}
        onChange={(e) => onChange('mode', e.target.value)}
        className={selectClass}
      >
        <option value="all">Wait for all</option>
        <option value="first">First completed</option>
        <option value="merge">Merge results</option>
      </select>
    </div>
  );
}

function EvaluatorConfig({
  data,
  onChange
}: {
  data: Record<string, unknown>;
  onChange: (field: string, value: unknown) => void;
}) {
  return (
    <div className="space-y-2">
      <div>
        <label className={labelClass}>Max Iterations</label>
        <input
          type="number"
          min={1}
          max={10}
          value={(data.maxIterations as number) || 3}
          onChange={(e) => onChange('maxIterations', parseInt(e.target.value) || 3)}
          className={clsx(inputClass, 'w-16')}
        />
      </div>

      <div>
        <label className={labelClass}>Criteria</label>
        <textarea
          value={(data.criteria as string) || ''}
          onChange={(e) => onChange('criteria', e.target.value)}
          placeholder="Acceptance criteria..."
          rows={2}
          className={textareaClass}
        />
      </div>
    </div>
  );
}

function WorkflowStartConfig() {
  return (
    <div className="text-[10px] text-slate-500 bg-blue-50 border border-blue-200 rounded p-1.5">
      Enter input in the node's textarea on the canvas.
    </div>
  );
}

function OutputConfig({ data }: { data: Record<string, unknown> }) {
  const results = (data.results as unknown[]) || [];
  return (
    <div className="text-[10px] text-slate-500">
      {results.length > 0 ? (
        <span className="text-green-600">{results.length} result(s) collected</span>
      ) : (
        <span>Waiting for workflow to complete...</span>
      )}
    </div>
  );
}
