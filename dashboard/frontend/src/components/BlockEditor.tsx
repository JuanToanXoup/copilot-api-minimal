import { useCallback } from 'react';
import { X, FileJson } from 'lucide-react';
import clsx from 'clsx';
import { useStore } from '../store';
import { getRoleConfig } from '../utils/roleConfig';
import type { Node } from '@xyflow/react';

interface BlockEditorProps {
  node: Node | null;
  onClose: () => void;
  onUpdateNode: (nodeId: string, data: Record<string, unknown>) => void;
}

export default function BlockEditor({ node, onClose, onUpdateNode }: BlockEditorProps) {
  const { roleDefinitions } = useStore();

  const handleChange = useCallback(
    (field: string, value: string) => {
      if (!node) return;
      onUpdateNode(node.id, { [field]: value });
    },
    [node, onUpdateNode]
  );

  if (!node || node.type !== 'agent') {
    return null;
  }

  const data = node.data as {
    label?: string;
    role?: string;
    outputType?: string;
    outputSchema?: string;
  };

  const currentRole = data.role || 'coder';
  const roleConfig = getRoleConfig(currentRole);
  const RoleIcon = roleConfig.icon;

  // Get schema placeholder based on output type
  const getSchemaPlaceholder = () => {
    switch (data.outputType) {
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
  "hasTests": true
}`;
      default:
        return `{
  "format": "description of expected format"
}`;
    }
  };

  return (
    <div className="w-80 bg-white border-l border-slate-200 flex flex-col h-full overflow-hidden shadow-lg">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
        <div className="flex items-center gap-2">
          <RoleIcon className={clsx('w-5 h-5', roleConfig.color)} />
          <h3 className="font-semibold text-slate-800">Block Editor</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Name Field */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Block Name
          </label>
          <input
            type="text"
            value={data.label || ''}
            onChange={(e) => handleChange('label', e.target.value)}
            placeholder="Enter block name..."
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-slate-400 mt-1">
            Display name for this block in the workflow
          </p>
        </div>

        {/* Role Field */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Role
          </label>
          <div className="grid grid-cols-2 gap-2">
            {roleDefinitions.map((role) => {
              const config = getRoleConfig(role.id);
              const Icon = config.icon;
              const isSelected = currentRole === role.id;
              return (
                <button
                  key={role.id}
                  onClick={() => handleChange('role', role.id)}
                  className={clsx(
                    'px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2',
                    isSelected
                      ? clsx(config.bgColor, config.color, 'ring-2 ring-offset-1', config.borderColor.replace('border-', 'ring-'))
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {role.label}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-slate-400 mt-2">
            The role determines the agent's behavior and expertise
          </p>
        </div>

        {/* Output Type Field */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Output Type
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'text', label: 'Text' },
              { id: 'code', label: 'Code' },
              { id: 'json', label: 'JSON' },
              { id: 'markdown', label: 'Markdown' },
            ].map((type) => (
              <button
                key={type.id}
                onClick={() => handleChange('outputType', type.id)}
                className={clsx(
                  'px-3 py-2 rounded-lg text-sm font-medium transition-all',
                  data.outputType === type.id
                    ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-400 ring-offset-1'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* Output Schema Field */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-2">
            <FileJson className="w-4 h-4 text-slate-500" />
            Output Schema
            <span className="text-xs font-normal text-slate-400">(optional)</span>
          </label>
          <textarea
            value={data.outputSchema || ''}
            onChange={(e) => handleChange('outputSchema', e.target.value)}
            placeholder={getSchemaPlaceholder()}
            rows={6}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
          />
          <p className="text-xs text-slate-400 mt-1">
            JSON schema to validate and structure the output
          </p>
        </div>

        {/* Role Description Preview */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Role Behavior
          </label>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-slate-700">
            {roleDefinitions.find((r) => r.id === currentRole)?.description || 'No description'}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Edit this in <span className="font-medium">Edit Roles</span> to change behavior
          </p>
        </div>
      </div>
    </div>
  );
}
