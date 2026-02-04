import { useState, useEffect, useCallback } from 'react';
import { Save, FolderOpen, Download, Upload, Trash2, X, Check, Clock } from 'lucide-react';
import clsx from 'clsx';
import type { Node, Edge } from '@xyflow/react';
import { useStore } from '../store';

interface SavedFlow {
  name: string;
  description?: string;
  templateId?: string;
  nodeCount: number;
  edgeCount: number;
  createdAt?: string;
  updatedAt?: string;
}

interface FlowData {
  name: string;
  description?: string;
  templateId?: string;
  nodes: Node[];
  edges: Edge[];
  createdAt?: string;
  updatedAt?: string;
}

interface FlowManagerProps {
  nodes: Node[];
  edges: Edge[];
  selectedTemplate: string;
  onLoadFlow: (nodes: Node[], edges: Edge[], templateId?: string) => void;
}

const API_BASE = 'http://localhost:8080';
const LOCAL_STORAGE_KEY = 'workflow-autosave';

function buildApiUrl(path: string, projectPath: string | null): string {
  const url = `${API_BASE}${path}`;
  if (projectPath) {
    return `${url}${url.includes('?') ? '&' : '?'}project_path=${encodeURIComponent(projectPath)}`;
  }
  return url;
}

export default function FlowManager({ nodes, edges, selectedTemplate, onLoadFlow }: FlowManagerProps) {
  const { activeProjectPath } = useStore();
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [flowName, setFlowName] = useState('');
  const [flowDescription, setFlowDescription] = useState('');
  const [savedFlows, setSavedFlows] = useState<SavedFlow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Auto-save to localStorage
  useEffect(() => {
    const autoSaveData: FlowData = {
      name: '__autosave__',
      templateId: selectedTemplate,
      nodes,
      edges,
    };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(autoSaveData));
    setLastAutoSave(new Date());
  }, [nodes, edges, selectedTemplate]);

  // Load saved flows list
  const loadFlowsList = useCallback(async () => {
    try {
      const response = await fetch(buildApiUrl('/api/flows', activeProjectPath));
      const data = await response.json();
      if (Array.isArray(data)) {
        setSavedFlows(data);
      }
    } catch (error) {
      console.error('Failed to load flows list:', error);
    }
  }, [activeProjectPath]);

  useEffect(() => {
    loadFlowsList();
  }, [loadFlowsList]);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  // Save flow to backend
  const handleSave = async () => {
    if (!flowName.trim()) return;

    setIsSaving(true);
    try {
      const flowData: FlowData = {
        name: flowName.trim(),
        description: flowDescription.trim(),
        templateId: selectedTemplate,
        nodes,
        edges,
      };

      const response = await fetch(buildApiUrl('/api/flows', activeProjectPath), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(flowData),
      });

      const result = await response.json();
      if (result.error) {
        showNotification('error', result.error);
      } else {
        showNotification('success', `Saved "${flowName}"`);
        setShowSaveModal(false);
        setFlowName('');
        setFlowDescription('');
        loadFlowsList();
      }
    } catch (error) {
      showNotification('error', 'Failed to save flow');
    } finally {
      setIsSaving(false);
    }
  };

  // Load flow from backend
  const handleLoad = async (name: string) => {
    try {
      const response = await fetch(buildApiUrl(`/api/flows/${encodeURIComponent(name)}`, activeProjectPath));
      const data = await response.json();
      if (data.error) {
        showNotification('error', data.error);
      } else {
        onLoadFlow(data.nodes, data.edges, data.templateId);
        setShowLoadModal(false);
        showNotification('success', `Loaded "${name}"`);
      }
    } catch (error) {
      showNotification('error', 'Failed to load flow');
    }
  };

  // Delete flow
  const handleDelete = async (name: string) => {
    if (!confirm(`Delete flow "${name}"?`)) return;

    try {
      const response = await fetch(buildApiUrl(`/api/flows/${encodeURIComponent(name)}`, activeProjectPath), {
        method: 'DELETE',
      });
      const result = await response.json();
      if (result.error) {
        showNotification('error', result.error);
      } else {
        showNotification('success', `Deleted "${name}"`);
        loadFlowsList();
      }
    } catch (error) {
      showNotification('error', 'Failed to delete flow');
    }
  };

  // Export to JSON file
  const handleExport = () => {
    const flowData: FlowData = {
      name: flowName || 'exported-flow',
      templateId: selectedTemplate,
      nodes,
      edges,
    };

    const blob = new Blob([JSON.stringify(flowData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${flowData.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('success', 'Flow exported');
  };

  // Import from JSON file
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string) as FlowData;
        if (data.nodes && data.edges) {
          onLoadFlow(data.nodes, data.edges, data.templateId);
          showNotification('success', `Imported "${data.name || 'flow'}"`);
        } else {
          showNotification('error', 'Invalid flow file');
        }
      } catch {
        showNotification('error', 'Failed to parse flow file');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  // Load autosave
  const handleLoadAutosave = () => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved) as FlowData;
        onLoadFlow(data.nodes, data.edges, data.templateId);
        showNotification('success', 'Restored from autosave');
      } catch {
        showNotification('error', 'Failed to restore autosave');
      }
    }
  };

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setShowSaveModal(true)}
          className="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-blue-600 transition-colors"
          title="Save Flow"
        >
          <Save className="w-4 h-4" />
        </button>
        <button
          onClick={() => { loadFlowsList(); setShowLoadModal(true); }}
          className="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-blue-600 transition-colors"
          title="Load Flow"
        >
          <FolderOpen className="w-4 h-4" />
        </button>
        <button
          onClick={handleExport}
          className="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-green-600 transition-colors"
          title="Export to JSON"
        >
          <Download className="w-4 h-4" />
        </button>
        <label className="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-orange-600 transition-colors cursor-pointer" title="Import from JSON">
          <Upload className="w-4 h-4" />
          <input type="file" accept=".json" onChange={handleImport} className="hidden" />
        </label>
        {lastAutoSave && (
          <span className="text-[10px] text-slate-400 flex items-center gap-1 ml-1">
            <Clock className="w-3 h-3" />
            {lastAutoSave.toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Notification */}
      {notification && (
        <div className={clsx(
          'fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm',
          notification.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        )}>
          {notification.type === 'success' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
          {notification.message}
        </div>
      )}

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-[400px] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <Save className="w-4 h-4 text-blue-500" />
                Save Flow
              </h3>
              <button onClick={() => setShowSaveModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600">Name</label>
                <input
                  type="text"
                  value={flowName}
                  onChange={(e) => setFlowName(e.target.value)}
                  placeholder="My Workflow"
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Description (optional)</label>
                <textarea
                  value={flowDescription}
                  onChange={(e) => setFlowDescription(e.target.value)}
                  placeholder="What does this flow do?"
                  rows={2}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="text-xs text-slate-500">
                {nodes.length} nodes, {edges.length} edges
              </div>
            </div>
            <div className="px-4 py-3 border-t bg-slate-50 flex justify-end gap-2">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!flowName.trim() || isSaving}
                className={clsx(
                  'px-3 py-1.5 text-sm rounded-lg',
                  flowName.trim() && !isSaving
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                )}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load Modal */}
      {showLoadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-[480px] max-h-[600px] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-blue-500" />
                Load Flow
              </h3>
              <button onClick={() => setShowLoadModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {/* Autosave option */}
              <button
                onClick={handleLoadAutosave}
                className="w-full p-3 rounded-lg border border-dashed border-slate-300 hover:border-blue-300 hover:bg-blue-50 text-left mb-2"
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span className="font-medium text-sm text-slate-700">Restore Autosave</span>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Load the last auto-saved state from this browser
                </div>
              </button>

              {/* Saved flows */}
              {savedFlows.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  No saved flows yet
                </div>
              ) : (
                <div className="space-y-2">
                  {savedFlows.map((flow) => (
                    <div
                      key={flow.name}
                      className="p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <button
                          onClick={() => handleLoad(flow.name)}
                          className="flex-1 text-left"
                        >
                          <div className="font-medium text-sm text-slate-700">{flow.name}</div>
                          {flow.description && (
                            <div className="text-xs text-slate-500 mt-0.5">{flow.description}</div>
                          )}
                          <div className="text-[10px] text-slate-400 mt-1">
                            {flow.nodeCount} nodes, {flow.edgeCount} edges
                            {flow.updatedAt && (
                              <span className="ml-2">
                                Updated {new Date(flow.updatedAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </button>
                        <button
                          onClick={() => handleDelete(flow.name)}
                          className="p-1 hover:bg-red-100 rounded text-slate-400 hover:text-red-500"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="px-4 py-3 border-t bg-slate-50 flex justify-between items-center">
              <label className="text-xs text-blue-500 hover:text-blue-600 cursor-pointer flex items-center gap-1">
                <Upload className="w-3 h-3" />
                Import from file
                <input type="file" accept=".json" onChange={(e) => { handleImport(e); setShowLoadModal(false); }} className="hidden" />
              </label>
              <button
                onClick={() => setShowLoadModal(false)}
                className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
