import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  GitBranch,
  Plus,
  Trash2,
  Save,
  Download,
  Upload,
  RefreshCw,
  Search,
  X,
  Folder,
  FolderOpen,
  FolderPlus,
  ChevronRight,
  ChevronDown,
  MoreVertical,
  Pencil,
  FileCode,
} from 'lucide-react';
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
  folder?: string | null;
}

interface FlowFolder {
  name: string;
  flowCount: number;
  parent: string | null;
}

interface FlowData {
  name: string;
  description?: string;
  templateId?: string;
  nodes: Node[];
  edges: Edge[];
  folder?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface WorkflowSidebarProps {
  nodes: Node[];
  edges: Edge[];
  selectedTemplate: string;
  onLoadFlow: (nodes: Node[], edges: Edge[], templateId?: string) => void;
}

const API_BASE = 'http://localhost:8080';

function buildApiUrl(path: string, projectPath: string | null): string {
  const url = `${API_BASE}${path}`;
  if (projectPath) {
    return `${url}${url.includes('?') ? '&' : '?'}project_path=${encodeURIComponent(projectPath)}`;
  }
  return url;
}

export default function WorkflowSidebar({ nodes, edges, selectedTemplate, onLoadFlow }: WorkflowSidebarProps) {
  const { activeProjectPath, addToast } = useStore();
  const [savedFlows, setSavedFlows] = useState<SavedFlow[]>([]);
  const [selectedFlow, setSelectedFlow] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Folder state
  const [folders, setFolders] = useState<FlowFolder[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['__root__']));
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolderIn, setCreatingFolderIn] = useState<string | null>(null);
  const [folderMenuOpen, setFolderMenuOpen] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  // Drag and drop state
  const [draggedFlow, setDraggedFlow] = useState<{ name: string; folder: string | null } | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);

  // Save modal state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [flowName, setFlowName] = useState('');
  const [flowDescription, setFlowDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // PlantUML import modal state
  const [showPlantUMLModal, setShowPlantUMLModal] = useState(false);
  const [plantUMLText, setPlantUMLText] = useState('');
  const [plantUMLName, setPlantUMLName] = useState('');
  const [isConverting, setIsConverting] = useState(false);

  // Sidebar resize state
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Handle sidebar resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = e.clientX;
      setSidebarWidth(Math.min(Math.max(newWidth, 200), 400));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  // Load saved flows list
  const loadFlowsList = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(buildApiUrl('/api/flows', activeProjectPath));
      const data = await response.json();
      if (Array.isArray(data)) {
        setSavedFlows(data);
      }
    } catch (error) {
      console.error('Failed to load flows list:', error);
    } finally {
      setIsLoading(false);
    }
  }, [activeProjectPath]);

  // Load folders
  const loadFolders = useCallback(async () => {
    try {
      const response = await fetch(buildApiUrl('/api/flows/folders/list', activeProjectPath));
      if (response.ok) {
        const data = await response.json();
        setFolders(data);
      }
    } catch (error) {
      console.error('Failed to load folders:', error);
    }
  }, [activeProjectPath]);

  useEffect(() => {
    loadFlowsList();
    loadFolders();
  }, [loadFlowsList, loadFolders]);

  // Filter flows by search
  const filteredFlows = useMemo(() => {
    return savedFlows.filter((flow) =>
      !searchQuery ||
      flow.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      flow.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [savedFlows, searchQuery]);

  // Group flows by folder
  const groupedByFolder = useMemo(() => {
    const groups: Record<string, SavedFlow[]> = { __root__: [] };
    filteredFlows.forEach((flow) => {
      const folder = flow.folder || '__root__';
      if (!groups[folder]) groups[folder] = [];
      groups[folder].push(flow);
    });
    return groups;
  }, [filteredFlows]);

  // Get root-level folders
  const rootFolders = useMemo(() => {
    return folders.filter((f) => !f.parent);
  }, [folders]);

  // Get child folders
  const getChildFolders = (parentName: string) => {
    return folders.filter((f) => f.parent === parentName);
  };

  // Get display name
  const getDisplayName = (fullName: string) => {
    const parts = fullName.split('/');
    return parts[parts.length - 1];
  };

  const toggleFolder = (folderName: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderName)) {
        next.delete(folderName);
      } else {
        next.add(folderName);
      }
      return next;
    });
  };

  // Folder CRUD operations
  const createFolder = async (name: string, parent?: string | null) => {
    try {
      const response = await fetch(buildApiUrl('/api/flows/folders', activeProjectPath), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, parent: parent || creatingFolderIn }),
      });
      const result = await response.json();
      if (result.error) {
        addToast({ type: 'error', title: 'Create failed', message: result.error });
        return false;
      }
      addToast({ type: 'success', title: 'Folder created', message: `Created "${result.name}"` });
      await loadFolders();
      setExpandedFolders((prev) => new Set([...prev, result.name]));
      return true;
    } catch (error) {
      addToast({ type: 'error', title: 'Create failed', message: String(error) });
      return false;
    }
  };

  const renameFolder = async (oldName: string, newName: string) => {
    try {
      const response = await fetch(buildApiUrl(`/api/flows/folders/${encodeURIComponent(oldName)}`, activeProjectPath), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      });
      const result = await response.json();
      if (result.error) {
        addToast({ type: 'error', title: 'Rename failed', message: result.error });
        return false;
      }
      addToast({ type: 'success', title: 'Folder renamed', message: `Renamed to "${result.newName}"` });
      await loadFolders();
      await loadFlowsList();
      return true;
    } catch (error) {
      addToast({ type: 'error', title: 'Rename failed', message: String(error) });
      return false;
    }
  };

  const deleteFolder = async (name: string, force: boolean = false) => {
    try {
      const baseUrl = buildApiUrl(`/api/flows/folders/${encodeURIComponent(name)}`, activeProjectPath);
      const response = await fetch(
        `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}force=${force}`,
        { method: 'DELETE' }
      );
      const result = await response.json();
      if (result.error) {
        if (result.flowCount) {
          const confirmed = confirm(
            `Folder "${name}" contains ${result.flowCount} workflow(s). Delete anyway?`
          );
          if (confirmed) {
            return deleteFolder(name, true);
          }
        } else {
          addToast({ type: 'error', title: 'Delete failed', message: result.error });
        }
        return false;
      }
      addToast({ type: 'success', title: 'Folder deleted', message: `Deleted "${name}"` });
      await loadFolders();
      await loadFlowsList();
      return true;
    } catch (error) {
      addToast({ type: 'error', title: 'Delete failed', message: String(error) });
      return false;
    }
  };

  const moveFlowToFolder = async (flowName: string, sourceFolder: string | null, targetFolder: string | null) => {
    if (sourceFolder === targetFolder) return false;
    try {
      const response = await fetch(buildApiUrl('/api/flows/move', activeProjectPath), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flowName, sourceFolder, targetFolder }),
      });
      const result = await response.json();
      if (result.error) {
        addToast({ type: 'error', title: 'Move failed', message: result.error });
        return false;
      }
      addToast({
        type: 'success',
        title: 'Workflow moved',
        message: targetFolder ? `Moved to "${targetFolder}"` : 'Moved to root',
      });
      await loadFlowsList();
      await loadFolders();
      return true;
    } catch (error) {
      addToast({ type: 'error', title: 'Move failed', message: String(error) });
      return false;
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, flowName: string, folder: string | null) => {
    setDraggedFlow({ name: flowName, folder });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedFlow(null);
    setDragOverFolder(null);
  };

  const handleDragOver = (e: React.DragEvent, folder: string | null) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverFolder(folder);
  };

  const handleDragLeave = () => {
    setDragOverFolder(null);
  };

  const handleDrop = async (e: React.DragEvent, targetFolder: string | null) => {
    e.preventDefault();
    if (draggedFlow) {
      const actualTarget = targetFolder === '__root__' ? null : targetFolder;
      await moveFlowToFolder(draggedFlow.name, draggedFlow.folder, actualTarget);
    }
    setDraggedFlow(null);
    setDragOverFolder(null);
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
        folder: selectedFolder,
      };

      const response = await fetch(buildApiUrl('/api/flows', activeProjectPath), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(flowData),
      });

      const result = await response.json();
      if (result.error) {
        addToast({ type: 'error', title: 'Save failed', message: result.error });
      } else {
        addToast({ type: 'success', title: 'Workflow saved', message: `Saved "${flowName}"` });
        setShowSaveModal(false);
        setFlowName('');
        setFlowDescription('');
        setSelectedFlow(flowName.trim());
        setSelectedFolder(null);
        loadFlowsList();
        loadFolders();
      }
    } catch (error) {
      addToast({ type: 'error', title: 'Save failed', message: String(error) });
    } finally {
      setIsSaving(false);
    }
  };

  // Load flow from backend
  const handleLoad = async (name: string, folder: string | null) => {
    try {
      const flowPath = folder ? `${folder}/${name}` : name;
      const response = await fetch(buildApiUrl(`/api/flows/${encodeURIComponent(flowPath)}`, activeProjectPath));
      const data = await response.json();
      if (data.error) {
        addToast({ type: 'error', title: 'Load failed', message: data.error });
      } else {
        onLoadFlow(data.nodes, data.edges, data.templateId);
        setSelectedFlow(name);
        addToast({ type: 'success', title: 'Workflow loaded', message: `Loaded "${name}"` });
      }
    } catch (error) {
      addToast({ type: 'error', title: 'Load failed', message: String(error) });
    }
  };

  // Delete flow
  const handleDelete = async (e: React.MouseEvent, name: string, folder: string | null) => {
    e.stopPropagation();
    if (!confirm(`Delete workflow "${name}"?`)) return;

    try {
      const flowPath = folder ? `${folder}/${name}` : name;
      const response = await fetch(buildApiUrl(`/api/flows/${encodeURIComponent(flowPath)}`, activeProjectPath), {
        method: 'DELETE',
      });
      const result = await response.json();
      if (result.error) {
        addToast({ type: 'error', title: 'Delete failed', message: result.error });
      } else {
        addToast({ type: 'success', title: 'Workflow deleted', message: `Deleted "${name}"` });
        if (selectedFlow === name) {
          setSelectedFlow(null);
        }
        loadFlowsList();
        loadFolders();
      }
    } catch (error) {
      addToast({ type: 'error', title: 'Delete failed', message: String(error) });
    }
  };

  // Export to JSON file
  const handleExport = () => {
    const flowData: FlowData = {
      name: selectedFlow || 'exported-flow',
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
    addToast({ type: 'success', title: 'Exported', message: 'Workflow exported to file' });
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
          addToast({ type: 'success', title: 'Imported', message: `Imported "${data.name || 'flow'}"` });
        } else {
          addToast({ type: 'error', title: 'Import failed', message: 'Invalid flow file' });
        }
      } catch {
        addToast({ type: 'error', title: 'Import failed', message: 'Failed to parse flow file' });
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  // Import from PlantUML
  const handlePlantUMLImport = async () => {
    if (!plantUMLText.trim()) return;

    setIsConverting(true);
    try {
      const response = await fetch(`${API_BASE}/api/workflows/from-plantuml`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plantuml: plantUMLText,
          name: plantUMLName.trim() || undefined,
        }),
      });

      const result = await response.json();

      if (result.error || response.status >= 400) {
        addToast({
          type: 'error',
          title: 'Conversion failed',
          message: result.error || result.detail?.error || 'Failed to convert PlantUML',
        });
        return;
      }

      if (result.nodes && result.edges) {
        onLoadFlow(result.nodes, result.edges);
        addToast({
          type: 'success',
          title: 'PlantUML imported',
          message: `Loaded "${result.name}" with ${result.nodes.length} nodes. Save it now.`,
        });
        // Close PlantUML modal and open Save modal with pre-filled name
        setShowPlantUMLModal(false);
        setPlantUMLText('');
        setPlantUMLName('');
        // Pre-fill the save modal with the workflow name
        setFlowName(result.name || 'Imported Workflow');
        setFlowDescription(result.description || 'Imported from PlantUML');
        setShowSaveModal(true);
      } else {
        addToast({ type: 'error', title: 'Conversion failed', message: 'Invalid response from server' });
      }
    } catch (error) {
      addToast({ type: 'error', title: 'Conversion failed', message: String(error) });
    } finally {
      setIsConverting(false);
    }
  };

  // Recursive folder renderer
  const renderFolder = (folder: FlowFolder, depth: number = 0) => {
    const childFolders = getChildFolders(folder.name);
    const displayName = getDisplayName(folder.name);
    const paddingLeft = 16 + depth * 16;

    return (
      <div
        key={folder.name}
        onDragOver={(e) => handleDragOver(e, folder.name)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, folder.name)}
      >
        <div
          className={clsx(
            'w-full pr-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2 hover:bg-slate-100 group transition-colors',
            dragOverFolder === folder.name && 'bg-blue-100 border-blue-300'
          )}
          style={{ paddingLeft }}
        >
          <button
            onClick={() => toggleFolder(folder.name)}
            className="flex items-center gap-2 flex-1 text-left"
          >
            {expandedFolders.has(folder.name) ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            )}
            <Folder className="w-3.5 h-3.5 text-blue-500" />
            {editingFolder === folder.name ? (
              <input
                type="text"
                defaultValue={displayName}
                autoFocus
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const newName = (e.target as HTMLInputElement).value.trim();
                    if (newName && newName !== displayName) {
                      renameFolder(folder.name, newName);
                    }
                    setEditingFolder(null);
                  } else if (e.key === 'Escape') {
                    setEditingFolder(null);
                  }
                }}
                onBlur={(e) => {
                  const newName = e.target.value.trim();
                  if (newName && newName !== displayName) {
                    renameFolder(folder.name, newName);
                  }
                  setEditingFolder(null);
                }}
                className="px-1 py-0.5 border border-blue-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            ) : (
              <span className="text-xs font-medium text-slate-600">{displayName}</span>
            )}
            <span className="text-xs text-slate-400">({groupedByFolder[folder.name]?.length || 0})</span>
          </button>
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setFolderMenuOpen(folderMenuOpen === folder.name ? null : folder.name);
              }}
              className="p-1 rounded hover:bg-slate-200 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreVertical className="w-3.5 h-3.5 text-slate-400" />
            </button>
            {folderMenuOpen === folder.name && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 py-1 min-w-[140px]">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFolder(folder.name);
                    setShowSaveModal(true);
                    setFolderMenuOpen(null);
                  }}
                  className="w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Workflow
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCreatingFolderIn(folder.name);
                    setExpandedFolders((prev) => new Set([...prev, folder.name]));
                    setFolderMenuOpen(null);
                  }}
                  className="w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  New Folder
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingFolder(folder.name);
                    setFolderMenuOpen(null);
                  }}
                  className="w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Rename
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteFolder(folder.name);
                    setFolderMenuOpen(null);
                  }}
                  className="w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
        {expandedFolders.has(folder.name) && (
          <>
            {/* Inline subfolder creation */}
            {creatingFolderIn === folder.name && (
              <div
                className="pr-4 py-2 border-b border-slate-100 bg-blue-50 flex items-center gap-2"
                style={{ paddingLeft: paddingLeft + 16 }}
              >
                <FolderPlus className="w-3.5 h-3.5 text-blue-500" />
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newFolderName.trim()) {
                      createFolder(newFolderName.trim());
                      setNewFolderName('');
                      setCreatingFolderIn(null);
                    } else if (e.key === 'Escape') {
                      setNewFolderName('');
                      setCreatingFolderIn(null);
                    }
                  }}
                  onBlur={() => {
                    if (!newFolderName.trim()) {
                      setCreatingFolderIn(null);
                    }
                  }}
                  placeholder="Folder name..."
                  autoFocus
                  className="flex-1 px-2 py-1 border border-blue-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
                <button
                  onClick={() => {
                    if (newFolderName.trim()) {
                      createFolder(newFolderName.trim());
                      setNewFolderName('');
                      setCreatingFolderIn(null);
                    }
                  }}
                  className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                >
                  Create
                </button>
              </div>
            )}
            {/* Child folders */}
            {childFolders.map((childFolder) => renderFolder(childFolder, depth + 1))}
            {/* Flows in this folder */}
            {groupedByFolder[folder.name]?.map((flow) => (
              <div
                key={`${folder.name}/${flow.name}`}
                draggable
                onDragStart={(e) => handleDragStart(e, flow.name, folder.name)}
                onDragEnd={handleDragEnd}
                onClick={() => handleLoad(flow.name, folder.name)}
                className={clsx(
                  'w-full pr-4 py-2.5 text-left border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-grab active:cursor-grabbing group',
                  selectedFlow === flow.name && 'bg-blue-50 border-l-2 border-l-blue-500',
                  draggedFlow?.name === flow.name && 'opacity-50'
                )}
                style={{ paddingLeft: paddingLeft + 16 }}
              >
                <div className="flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-slate-800 truncate">{flow.name}</div>
                    <div className="text-[10px] text-slate-400">
                      {flow.nodeCount} nodes, {flow.edgeCount} edges
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDelete(e, flow.name, folder.name)}
                    className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleImport}
        className="hidden"
      />

      {/* Sidebar */}
      <div
        ref={sidebarRef}
        style={{ width: sidebarWidth }}
        className="flex-shrink-0 bg-white border border-slate-200 rounded-lg shadow-sm flex flex-col relative overflow-hidden"
      >
        {/* Resize handle */}
        <div
          className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-400 transition-colors z-10"
          onMouseDown={() => setIsResizing(true)}
        />

        {/* Header */}
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-800">Workflows</h2>
            <div className="flex items-center gap-1">
              <button
                onClick={() => { loadFlowsList(); loadFolders(); }}
                className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                title="Refresh"
              >
                <RefreshCw className={clsx('w-4 h-4', isLoading && 'animate-spin')} />
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                title="Import from JSON"
              >
                <Upload className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowPlantUMLModal(true)}
                className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                title="Import from PlantUML"
              >
                <FileCode className="w-4 h-4" />
              </button>
              <button
                onClick={handleExport}
                className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                title="Export to JSON"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowSaveModal(true)}
                className="p-1.5 rounded bg-blue-500 text-white hover:bg-blue-600"
                title="Save workflow"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search workflows..."
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        </div>

        {/* Stats bar */}
        <div className="px-4 py-2 border-b border-slate-200">
          <span className="text-xs text-slate-400">
            {folders.length} folder{folders.length !== 1 ? 's' : ''}, {savedFlows.length} workflow{savedFlows.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Workflow List with Folders */}
        <div className="flex-1 overflow-y-auto">
          {/* Root level */}
          <div
            onDragOver={(e) => handleDragOver(e, '__root__')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, null)}
          >
            {/* Inline folder creation at root */}
            {creatingFolderIn === '__root__' && (
              <div className="px-4 py-2 border-b border-slate-100 bg-blue-50 flex items-center gap-2">
                <FolderPlus className="w-3.5 h-3.5 text-blue-500" />
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newFolderName.trim()) {
                      createFolder(newFolderName.trim(), null);
                      setNewFolderName('');
                      setCreatingFolderIn(null);
                    } else if (e.key === 'Escape') {
                      setNewFolderName('');
                      setCreatingFolderIn(null);
                    }
                  }}
                  onBlur={() => {
                    if (!newFolderName.trim()) {
                      setCreatingFolderIn(null);
                    }
                  }}
                  placeholder="Folder name..."
                  autoFocus
                  className="flex-1 px-2 py-1 border border-blue-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
                <button
                  onClick={() => {
                    if (newFolderName.trim()) {
                      createFolder(newFolderName.trim(), null);
                      setNewFolderName('');
                      setCreatingFolderIn(null);
                    }
                  }}
                  className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                >
                  Create
                </button>
              </div>
            )}

            {/* Root folder header */}
            <div
              className={clsx(
                'w-full px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2 hover:bg-slate-100 group transition-colors',
                dragOverFolder === '__root__' && 'bg-blue-100 border-blue-300'
              )}
            >
              <button
                onClick={() => toggleFolder('__root__')}
                className="flex items-center gap-2 flex-1 text-left"
              >
                {expandedFolders.has('__root__') ? (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                )}
                <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs font-medium text-slate-600">Root</span>
                <span className="text-xs text-slate-400">({groupedByFolder['__root__']?.length || 0})</span>
              </button>
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setFolderMenuOpen(folderMenuOpen === '__root__' ? null : '__root__');
                  }}
                  className="p-1 rounded hover:bg-slate-200 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreVertical className="w-3.5 h-3.5 text-slate-400" />
                </button>
                {folderMenuOpen === '__root__' && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 py-1 min-w-[140px]">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFolder(null);
                        setShowSaveModal(true);
                        setFolderMenuOpen(null);
                      }}
                      className="w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      New Workflow
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCreatingFolderIn('__root__');
                        setFolderMenuOpen(null);
                      }}
                      className="w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                      New Folder
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Root workflows */}
            {expandedFolders.has('__root__') &&
              groupedByFolder['__root__']?.map((flow) => (
                <div
                  key={flow.name}
                  draggable
                  onDragStart={(e) => handleDragStart(e, flow.name, null)}
                  onDragEnd={handleDragEnd}
                  onClick={() => handleLoad(flow.name, null)}
                  className={clsx(
                    'w-full pl-12 pr-4 py-2.5 text-left border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-grab active:cursor-grabbing group',
                    selectedFlow === flow.name && 'bg-blue-50 border-l-2 border-l-blue-500',
                    draggedFlow?.name === flow.name && 'opacity-50'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-slate-800 truncate">{flow.name}</div>
                      <div className="text-[10px] text-slate-400">
                        {flow.nodeCount} nodes, {flow.edgeCount} edges
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDelete(e, flow.name, null)}
                      className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
          </div>

          {/* Folders - rendered hierarchically */}
          {rootFolders.map((folder) => renderFolder(folder, 0))}

          {filteredFlows.length === 0 && !isLoading && (
            <div className="p-8 text-center text-slate-400">
              <GitBranch className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No workflows found</p>
              <button
                onClick={() => setShowSaveModal(true)}
                className="mt-2 text-blue-500 hover:text-blue-600 text-sm"
              >
                Save current workflow
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-[400px] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <Save className="w-4 h-4 text-blue-500" />
                Save Workflow
              </h3>
              <button onClick={() => { setShowSaveModal(false); setSelectedFolder(null); }} className="p-1 hover:bg-slate-100 rounded">
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
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Folder</label>
                <select
                  value={selectedFolder || ''}
                  onChange={(e) => setSelectedFolder(e.target.value || null)}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Root (no folder)</option>
                  {folders.map((f) => (
                    <option key={f.name} value={f.name}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Description (optional)</label>
                <textarea
                  value={flowDescription}
                  onChange={(e) => setFlowDescription(e.target.value)}
                  placeholder="What does this workflow do?"
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
                onClick={() => { setShowSaveModal(false); setSelectedFolder(null); }}
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

      {/* PlantUML Import Modal */}
      {showPlantUMLModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-[500px] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <FileCode className="w-4 h-4 text-green-500" />
                Import from PlantUML
              </h3>
              <button
                onClick={() => {
                  setShowPlantUMLModal(false);
                  setPlantUMLText('');
                  setPlantUMLName('');
                }}
                className="p-1 hover:bg-slate-100 rounded"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600">Workflow Name (optional)</label>
                <input
                  type="text"
                  value={plantUMLName}
                  onChange={(e) => setPlantUMLName(e.target.value)}
                  placeholder="My Workflow"
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">PlantUML Diagram</label>
                <textarea
                  value={plantUMLText}
                  onChange={(e) => setPlantUMLText(e.target.value)}
                  placeholder={`@startuml
title My Workflow

start

:First Step;
note right
  <<prompt>>
  template: my-template
  input: {{input}}
end note

:Second Step;

stop

@enduml`}
                  rows={12}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
                  autoFocus
                />
              </div>
              <div className="text-xs text-slate-500">
                Paste a PlantUML activity diagram. Use annotations like <code className="bg-slate-100 px-1 rounded">&lt;&lt;prompt&gt;&gt;</code> to configure nodes.
              </div>
            </div>
            <div className="px-4 py-3 border-t bg-slate-50 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowPlantUMLModal(false);
                  setPlantUMLText('');
                  setPlantUMLName('');
                }}
                className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handlePlantUMLImport}
                disabled={!plantUMLText.trim() || isConverting}
                className={clsx(
                  'px-3 py-1.5 text-sm rounded-lg',
                  plantUMLText.trim() && !isConverting
                    ? 'bg-green-500 text-white hover:bg-green-600'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                )}
              >
                {isConverting ? 'Converting...' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
