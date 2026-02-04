import { useState, useCallback, useMemo } from 'react';
import { useStore } from '../store';
import * as promptService from '../services/promptService';
import type { FolderInfo } from '../services/promptService';

interface UseFolderManagementOptions {
  onFoldersChanged?: () => void;
  onPromptsChanged?: () => void;
}

export function useFolderManagement(options: UseFolderManagementOptions = {}) {
  const { addToast } = useStore();

  const [folders, setFolders] = useState<FolderInfo[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['__root__']));
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolderIn, setCreatingFolderIn] = useState<string | null>(null);
  const [folderMenuOpen, setFolderMenuOpen] = useState<string | null>(null);

  // Load folders from backend
  const loadFolders = useCallback(async () => {
    try {
      const data = await promptService.loadFolders();
      setFolders(data);
    } catch (error) {
      console.error('Failed to load folders:', error);
    }
  }, []);

  // Create a new folder
  const createFolder = useCallback(async (name: string, parent?: string | null) => {
    try {
      const result = await promptService.createFolder(name, parent ?? creatingFolderIn);
      if (result.error) {
        addToast({ type: 'error', title: 'Create failed', message: result.error });
        return false;
      }
      addToast({ type: 'success', title: 'Folder created', message: `Created "${result.name}"` });
      await loadFolders();
      if (result.name) {
        setExpandedFolders((prev) => new Set([...prev, result.name!]));
      }
      options.onFoldersChanged?.();
      return true;
    } catch (error) {
      addToast({ type: 'error', title: 'Create failed', message: String(error) });
      return false;
    }
  }, [creatingFolderIn, addToast, loadFolders, options]);

  // Rename a folder
  const renameFolder = useCallback(async (oldName: string, newName: string) => {
    try {
      const result = await promptService.renameFolder(oldName, newName);
      if (result.error) {
        addToast({ type: 'error', title: 'Rename failed', message: result.error });
        return false;
      }
      addToast({ type: 'success', title: 'Folder renamed', message: `Renamed to "${result.newName}"` });
      await loadFolders();
      options.onFoldersChanged?.();
      options.onPromptsChanged?.();
      return true;
    } catch (error) {
      addToast({ type: 'error', title: 'Rename failed', message: String(error) });
      return false;
    }
  }, [addToast, loadFolders, options]);

  // Delete a folder
  const deleteFolder = useCallback(async (name: string, force: boolean = false): Promise<boolean> => {
    try {
      const result = await promptService.deleteFolder(name, force);
      if (result.error) {
        if (result.promptCount) {
          const confirmed = confirm(
            `Folder "${name}" contains ${result.promptCount} prompt(s). Delete anyway?`
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
      options.onFoldersChanged?.();
      options.onPromptsChanged?.();
      return true;
    } catch (error) {
      addToast({ type: 'error', title: 'Delete failed', message: String(error) });
      return false;
    }
  }, [addToast, loadFolders, options]);

  // Toggle folder expansion
  const toggleFolder = useCallback((folderName: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderName)) {
        next.delete(folderName);
      } else {
        next.add(folderName);
      }
      return next;
    });
  }, []);

  // Get root-level folders (no parent)
  const rootFolders = useMemo(() => {
    return folders.filter((f) => !f.parent);
  }, [folders]);

  // Get child folders for a given parent
  const getChildFolders = useCallback((parentName: string) => {
    return folders.filter((f) => f.parent === parentName);
  }, [folders]);

  // Get display name (just the last segment of the path)
  const getDisplayName = useCallback((fullName: string) => {
    const parts = fullName.split('/');
    return parts[parts.length - 1];
  }, []);

  return {
    folders,
    setFolders,
    expandedFolders,
    setExpandedFolders,
    editingFolder,
    setEditingFolder,
    newFolderName,
    setNewFolderName,
    creatingFolderIn,
    setCreatingFolderIn,
    folderMenuOpen,
    setFolderMenuOpen,
    loadFolders,
    createFolder,
    renameFolder,
    deleteFolder,
    toggleFolder,
    rootFolders,
    getChildFolders,
    getDisplayName,
  };
}
