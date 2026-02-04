import { useState } from 'react';
import { Bot, X, FolderOpen } from 'lucide-react';
import clsx from 'clsx';

interface SpawnAgentModalProps {
  onClose: () => void;
  onSpawn: (projectPath: string) => void;
}

export default function SpawnAgentModal({ onClose, onSpawn }: SpawnAgentModalProps) {
  const [projectPath, setProjectPath] = useState('');
  const [isSpawning, setIsSpawning] = useState(false);

  const handleSpawn = async () => {
    if (!projectPath.trim()) return;

    setIsSpawning(true);
    try {
      onSpawn(projectPath.trim());
      onClose();
    } finally {
      setIsSpawning(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-[440px] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Bot className="w-5 h-5 text-blue-500" />
            Add New Agent
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="px-6 py-4 space-y-4">
          {/* Project Path */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Project Folder
            </label>
            <div className="relative">
              <FolderOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={projectPath}
                onChange={(e) => setProjectPath(e.target.value)}
                placeholder="/path/to/your/project"
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Full path to the project folder to open in IntelliJ
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSpawn}
            disabled={!projectPath.trim() || isSpawning}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all',
              projectPath.trim() && !isSpawning
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            )}
          >
            {isSpawning ? 'Launching...' : 'Launch Agent'}
          </button>
        </div>
      </div>
    </div>
  );
}
