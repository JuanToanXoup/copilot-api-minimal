import { useState } from 'react';
import { X, RotateCcw, Settings, Save } from 'lucide-react';
import clsx from 'clsx';
import { useStore, type RoleDefinition } from '../store';
import { getRoleConfig } from '../utils/roleConfig';

interface RoleEditorProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function RoleEditor({ isOpen, onClose }: RoleEditorProps) {
  const { roleDefinitions, updateRoleDefinition, resetRoleDefinitions } = useStore();
  const [selectedRole, setSelectedRole] = useState<string>(roleDefinitions[0]?.id || 'coder');
  const [hasChanges, setHasChanges] = useState(false);

  if (!isOpen) return null;

  const currentRole = roleDefinitions.find((r) => r.id === selectedRole);

  const handleUpdate = (field: keyof Omit<RoleDefinition, 'id'>, value: string) => {
    updateRoleDefinition(selectedRole, { [field]: value });
    setHasChanges(true);
  };

  const handleReset = () => {
    if (confirm('Reset all roles to default? Your customizations will be lost.')) {
      resetRoleDefinitions();
      setHasChanges(false);
    }
  };

  const handleSave = () => {
    setHasChanges(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-[700px] max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-500" />
            Role Editor
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              title="Reset all roles to default"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Role List */}
          <div className="w-48 border-r border-slate-200 bg-slate-50 p-3 overflow-y-auto">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              Roles
            </div>
            <div className="space-y-1">
              {roleDefinitions.map((role) => {
                const config = getRoleConfig(role.id);
                const Icon = config.icon;
                return (
                  <button
                    key={role.id}
                    onClick={() => setSelectedRole(role.id)}
                    className={clsx(
                      'w-full px-3 py-2 rounded-lg text-left text-sm font-medium transition-colors flex items-center gap-2',
                      selectedRole === role.id
                        ? clsx(config.bgColor, config.color)
                        : 'text-slate-600 hover:bg-slate-100'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {role.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Editor */}
          <div className="flex-1 p-6 overflow-y-auto">
            {currentRole && (
              <div className="space-y-5">
                {/* Role Name */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Role Name
                  </label>
                  <input
                    type="text"
                    value={currentRole.label}
                    onChange={(e) => handleUpdate('label', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Role Description / System Prompt */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Role Instructions
                    <span className="text-slate-400 font-normal ml-1">(System Prompt)</span>
                  </label>
                  <textarea
                    value={currentRole.description}
                    onChange={(e) => handleUpdate('description', e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                    placeholder="Describe what this role should do..."
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    This is prepended to every prompt sent to agents with this role.
                  </p>
                </div>

                {/* Output Instruction */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Output Instruction
                  </label>
                  <textarea
                    value={currentRole.outputInstruction}
                    onChange={(e) => handleUpdate('outputInstruction', e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                    placeholder="Describe the expected output format..."
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    Guidance on what kind of output to produce.
                  </p>
                </div>

                {/* Preview */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Prompt Preview
                  </label>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs font-mono text-slate-700 whitespace-pre-wrap">
                    {`[Role: ${currentRole.label.toUpperCase()}]\n${currentRole.description}\n\n[Output Expectation]\n${currentRole.outputInstruction}`}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
          <p className="text-xs text-slate-500">
            {hasChanges ? 'You have unsaved changes' : 'Changes are auto-saved'}
          </p>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
          >
            <Save className="w-4 h-4" />
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
