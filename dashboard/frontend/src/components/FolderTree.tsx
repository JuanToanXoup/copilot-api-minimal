import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderPlus,
  MoreVertical,
  Plus,
  Pencil,
  Trash2,
  FileText,
} from 'lucide-react';
import clsx from 'clsx';
import type { PromptTemplate } from '../types';
import type { FolderInfo } from '../services/promptService';

interface FolderTreeProps {
  folder: FolderInfo;
  depth?: number;
  expandedFolders: Set<string>;
  editingFolder: string | null;
  folderMenuOpen: string | null;
  creatingFolderIn: string | null;
  newFolderName: string;
  dragOverFolder: string | null;
  draggedPromptId: string | null;
  selectedPromptId: string | null;
  promptsByFolder: Record<string, (PromptTemplate & { folder?: string | null })[]>;
  getChildFolders: (parentName: string) => FolderInfo[];
  getDisplayName: (fullName: string) => string;
  onToggleFolder: (folderName: string) => void;
  onSetEditingFolder: (folderName: string | null) => void;
  onSetFolderMenuOpen: (folderName: string | null) => void;
  onSetCreatingFolderIn: (folderName: string | null) => void;
  onSetNewFolderName: (name: string) => void;
  onSetExpandedFolders: (updater: (prev: Set<string>) => Set<string>) => void;
  onRenameFolder: (oldName: string, newName: string) => Promise<boolean>;
  onDeleteFolder: (name: string) => Promise<boolean>;
  onCreateFolder: (name: string) => Promise<boolean>;
  onSelectPrompt: (prompt: PromptTemplate & { folder?: string | null }) => void;
  onStartCreatingPrompt: (folder: string) => void;
  onDragStart: (e: React.DragEvent, promptId: string, folder: string | null) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent, folder: string | null) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, folder: string | null) => void;
}

export default function FolderTree({
  folder,
  depth = 0,
  expandedFolders,
  editingFolder,
  folderMenuOpen,
  creatingFolderIn,
  newFolderName,
  dragOverFolder,
  draggedPromptId,
  selectedPromptId,
  promptsByFolder,
  getChildFolders,
  getDisplayName,
  onToggleFolder,
  onSetEditingFolder,
  onSetFolderMenuOpen,
  onSetCreatingFolderIn,
  onSetNewFolderName,
  onSetExpandedFolders,
  onRenameFolder,
  onDeleteFolder,
  onCreateFolder,
  onSelectPrompt,
  onStartCreatingPrompt,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: FolderTreeProps) {
  const childFolders = getChildFolders(folder.name);
  const displayName = getDisplayName(folder.name);
  const paddingLeft = 16 + depth * 16;

  return (
    <div
      onDragOver={(e) => onDragOver(e, folder.name)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, folder.name)}
    >
      <div
        className={clsx(
          'w-full pr-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2 hover:bg-slate-100 group transition-colors',
          dragOverFolder === folder.name && 'bg-indigo-100 border-indigo-300'
        )}
        style={{ paddingLeft }}
      >
        <button
          onClick={() => onToggleFolder(folder.name)}
          className="flex items-center gap-2 flex-1 text-left"
        >
          {expandedFolders.has(folder.name) ? (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          )}
          <Folder className="w-3.5 h-3.5 text-indigo-500" />
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
                    onRenameFolder(folder.name, newName);
                  }
                  onSetEditingFolder(null);
                } else if (e.key === 'Escape') {
                  onSetEditingFolder(null);
                }
              }}
              onBlur={(e) => {
                const newName = e.target.value.trim();
                if (newName && newName !== displayName) {
                  onRenameFolder(folder.name, newName);
                }
                onSetEditingFolder(null);
              }}
              className="px-1 py-0.5 border border-indigo-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          ) : (
            <span className="text-xs font-medium text-slate-600">{displayName}</span>
          )}
          <span className="text-xs text-slate-400">({promptsByFolder[folder.name]?.length || 0})</span>
        </button>
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSetFolderMenuOpen(folderMenuOpen === folder.name ? null : folder.name);
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
                  onStartCreatingPrompt(folder.name);
                  onSetFolderMenuOpen(null);
                }}
                className="w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
              >
                <Plus className="w-3.5 h-3.5" />
                New Prompt
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSetCreatingFolderIn(folder.name);
                  onSetExpandedFolders((prev) => new Set([...prev, folder.name]));
                  onSetFolderMenuOpen(null);
                }}
                className="w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                New Folder
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSetEditingFolder(folder.name);
                  onSetFolderMenuOpen(null);
                }}
                className="w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
              >
                <Pencil className="w-3.5 h-3.5" />
                Rename
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteFolder(folder.name);
                  onSetFolderMenuOpen(null);
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
              className="pr-4 py-2 border-b border-slate-100 bg-indigo-50 flex items-center gap-2"
              style={{ paddingLeft: paddingLeft + 16 }}
            >
              <FolderPlus className="w-3.5 h-3.5 text-indigo-500" />
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => onSetNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newFolderName.trim()) {
                    onCreateFolder(newFolderName.trim());
                    onSetNewFolderName('');
                    onSetCreatingFolderIn(null);
                  } else if (e.key === 'Escape') {
                    onSetNewFolderName('');
                    onSetCreatingFolderIn(null);
                  }
                }}
                onBlur={() => {
                  if (!newFolderName.trim()) {
                    onSetCreatingFolderIn(null);
                  }
                }}
                placeholder="Folder name..."
                autoFocus
                className="flex-1 px-2 py-1 border border-indigo-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
              <button
                onClick={() => {
                  if (newFolderName.trim()) {
                    onCreateFolder(newFolderName.trim());
                    onSetNewFolderName('');
                    onSetCreatingFolderIn(null);
                  }
                }}
                className="px-2 py-1 bg-indigo-500 text-white rounded text-xs hover:bg-indigo-600"
              >
                Create
              </button>
            </div>
          )}
          {/* Child folders */}
          {childFolders.map((childFolder) => (
            <FolderTree
              key={childFolder.name}
              folder={childFolder}
              depth={depth + 1}
              expandedFolders={expandedFolders}
              editingFolder={editingFolder}
              folderMenuOpen={folderMenuOpen}
              creatingFolderIn={creatingFolderIn}
              newFolderName={newFolderName}
              dragOverFolder={dragOverFolder}
              draggedPromptId={draggedPromptId}
              selectedPromptId={selectedPromptId}
              promptsByFolder={promptsByFolder}
              getChildFolders={getChildFolders}
              getDisplayName={getDisplayName}
              onToggleFolder={onToggleFolder}
              onSetEditingFolder={onSetEditingFolder}
              onSetFolderMenuOpen={onSetFolderMenuOpen}
              onSetCreatingFolderIn={onSetCreatingFolderIn}
              onSetNewFolderName={onSetNewFolderName}
              onSetExpandedFolders={onSetExpandedFolders}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
              onCreateFolder={onCreateFolder}
              onSelectPrompt={onSelectPrompt}
              onStartCreatingPrompt={onStartCreatingPrompt}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
            />
          ))}
          {/* Prompts in this folder */}
          {promptsByFolder[folder.name]?.map((prompt) => (
            <div
              key={prompt.id}
              draggable
              onDragStart={(e) => onDragStart(e, prompt.id, folder.name)}
              onDragEnd={onDragEnd}
              onClick={() => onSelectPrompt(prompt)}
              className={clsx(
                'w-full pr-4 py-2.5 text-left border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-grab active:cursor-grabbing',
                selectedPromptId === prompt.id && 'bg-indigo-50 border-l-2 border-l-indigo-500',
                draggedPromptId === prompt.id && 'opacity-50'
              )}
              style={{ paddingLeft: paddingLeft + 16 }}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <div className="font-medium text-sm text-slate-800 truncate">{prompt.name}</div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
