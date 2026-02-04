import { useCallback, useState } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { PromptWorkflowTemplate } from '../promptWorkflowTemplates';
import { promptWorkflowTemplates } from '../promptWorkflowTemplates';

// Get default template
const defaultTemplate = promptWorkflowTemplates[0];

interface UseFlowManagementProps {
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  setWorkflowStatus: React.Dispatch<React.SetStateAction<'idle' | 'running' | 'complete'>>;
  runWorkflowRef: React.RefObject<(prompt: string) => Promise<void>>;
  runPromptBlockWorkflowRef: React.RefObject<(input: string) => Promise<void>>;
}

export function useFlowManagement({
  setNodes,
  setEdges,
  setWorkflowStatus,
  runWorkflowRef,
  runPromptBlockWorkflowRef,
}: UseFlowManagementProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>(defaultTemplate.id);

  // Reattach callbacks to workflow nodes
  const reattachCallbacks = useCallback(() => {
    setTimeout(() => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.type === 'prompt') {
            return {
              ...node,
              data: {
                ...node.data,
                onSubmit: (prompt: string) => runWorkflowRef.current?.(prompt),
              },
            };
          }
          if (node.type === 'supervisor') {
            return {
              ...node,
              data: {
                ...node.data,
                onStart: (prompt: string) => runWorkflowRef.current?.(prompt),
              },
            };
          }
          if (node.type === 'workflowStart') {
            return {
              ...node,
              data: {
                ...node.data,
                onStart: (input: string) => runPromptBlockWorkflowRef.current?.(input),
              },
            };
          }
          return node;
        })
      );
    }, 0);
  }, [setNodes, runWorkflowRef, runPromptBlockWorkflowRef]);

  // Handle template selection
  const handleSelectTemplate = useCallback((template: PromptWorkflowTemplate) => {
    setSelectedTemplate(template.id);
    setWorkflowStatus('idle');

    // Deep clone the template nodes and edges to avoid mutation
    const newNodes = template.nodes.map(node => ({
      ...node,
      data: { ...node.data },
    }));
    const newEdges = template.edges.map(edge => ({ ...edge }));

    setNodes(newNodes);
    setEdges(newEdges);

    // Re-attach callbacks after a tick
    reattachCallbacks();
  }, [setNodes, setEdges, setWorkflowStatus, reattachCallbacks]);

  // Handle loading a flow (from FlowManager)
  const handleLoadFlow = useCallback((loadedNodes: Node[], loadedEdges: Edge[], templateId?: string) => {
    setNodes(loadedNodes);
    setEdges(loadedEdges);
    if (templateId) {
      setSelectedTemplate(templateId);
    }
    setWorkflowStatus('idle');

    // Re-attach callbacks after loading
    reattachCallbacks();
  }, [setNodes, setEdges, setWorkflowStatus, reattachCallbacks]);

  // Initialize callbacks on nodes (call once on mount)
  const initializeCallbacks = useCallback(() => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.type === 'prompt') {
          return {
            ...node,
            data: {
              ...node.data,
              onSubmit: (prompt: string) => runWorkflowRef.current?.(prompt),
            },
          };
        }
        if (node.type === 'supervisor') {
          return {
            ...node,
            data: {
              ...node.data,
              onStart: (prompt: string) => runWorkflowRef.current?.(prompt),
            },
          };
        }
        if (node.type === 'workflowStart') {
          return {
            ...node,
            data: {
              ...node.data,
              onStart: (input: string) => runPromptBlockWorkflowRef.current?.(input),
            },
          };
        }
        return node;
      })
    );
  }, [setNodes, runWorkflowRef, runPromptBlockWorkflowRef]);

  return {
    selectedTemplate,
    handleSelectTemplate,
    handleLoadFlow,
    initializeCallbacks,
  };
}
