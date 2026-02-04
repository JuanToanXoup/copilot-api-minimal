import { useState, useCallback } from 'react';
import { useStore } from '../store';
import * as promptService from '../services/promptService';

interface DraggedPrompt {
  id: string;
  folder: string | null;
}

interface UsePromptDragDropOptions {
  onMoveSuccess?: () => void;
}

export function usePromptDragDrop(options: UsePromptDragDropOptions = {}) {
  const { addToast } = useStore();
  const [draggedPrompt, setDraggedPrompt] = useState<DraggedPrompt | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, promptId: string, folder: string | null) => {
    setDraggedPrompt({ id: promptId, folder });
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedPrompt(null);
    setDragOverFolder(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, folder: string | null) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverFolder(folder);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverFolder(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, targetFolder: string | null) => {
    e.preventDefault();
    if (!draggedPrompt) {
      setDragOverFolder(null);
      return;
    }

    const actualTarget = targetFolder === '__root__' ? null : targetFolder;
    if (draggedPrompt.folder === actualTarget) {
      setDraggedPrompt(null);
      setDragOverFolder(null);
      return;
    }

    try {
      const result = await promptService.movePromptToFolder(
        draggedPrompt.id,
        draggedPrompt.folder,
        actualTarget
      );

      if (result.error) {
        addToast({ type: 'error', title: 'Move failed', message: result.error });
      } else {
        addToast({
          type: 'success',
          title: 'Prompt moved',
          message: actualTarget ? `Moved to "${actualTarget}"` : 'Moved to root',
        });
        options.onMoveSuccess?.();
      }
    } catch (error) {
      addToast({ type: 'error', title: 'Move failed', message: String(error) });
    }

    setDraggedPrompt(null);
    setDragOverFolder(null);
  }, [draggedPrompt, addToast, options]);

  return {
    draggedPrompt,
    dragOverFolder,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
}
