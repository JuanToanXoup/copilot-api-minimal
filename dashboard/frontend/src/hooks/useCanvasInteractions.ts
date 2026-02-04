import { useCallback, useRef, useState } from 'react';
import type { Node, Edge, Connection } from '@xyflow/react';
import { addEdge, useReactFlow } from '@xyflow/react';
import { useStore } from '../store';
import { getHierarchicalLayout } from '../utils/canvasLayout';
import type { Agent } from '../types';

interface UseCanvasInteractionsProps {
  nodes: Node[];
  edges: Edge[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
}

export function useCanvasInteractions({
  nodes,
  edges,
  setNodes,
  setEdges,
}: UseCanvasInteractionsProps) {
  const { addToast } = useStore();
  const { fitView } = useReactFlow();
  const nodeIdCounter = useRef(10);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Get the selected node object
  const selectedNode = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) || null : null;

  // Handle edge connections
  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [setEdges]
  );

  // Handle dropping an agent onto the canvas
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const agentData = event.dataTransfer.getData('application/agent');
      if (!agentData) return;

      const agent: Agent = JSON.parse(agentData);
      const position = {
        x: event.clientX - 300,
        y: event.clientY - 100,
      };

      const newNode: Node = {
        id: `agent-${nodeIdCounter.current++}`,
        type: 'agent',
        position,
        data: {
          label: `:${agent.port}`,
          agent,
          status: 'idle',
          response: '',
        },
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes]
  );

  // Handle drag over for drop zone
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Handle starting a drag from sidebar
  const onDragStart = useCallback((event: React.DragEvent, agent: Agent) => {
    event.dataTransfer.setData('application/agent', JSON.stringify(agent));
    event.dataTransfer.effectAllowed = 'move';
  }, []);

  // Handle node click to open block editor
  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    if (node.type === 'agent') {
      setSelectedNodeId(node.id);
    }
  }, []);

  // Close block editor when clicking on canvas background
  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  // Handle updating node data from BlockEditor
  const handleUpdateNodeData = useCallback((nodeId: string, updates: Record<string, unknown>) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return { ...node, data: { ...node.data, ...updates } };
        }
        return node;
      })
    );
  }, [setNodes]);

  // Auto-arrange nodes in hierarchical layout
  const handleAutoArrange = useCallback(() => {
    const arrangedNodes = getHierarchicalLayout(nodes, edges);
    setNodes(arrangedNodes);

    setTimeout(() => {
      fitView({ padding: 0.2, duration: 300 });
    }, 50);

    addToast({
      type: 'info',
      title: 'Layout Applied',
      message: 'Nodes arranged in hierarchical layout.',
      duration: 2000,
    });
  }, [nodes, edges, setNodes, fitView, addToast]);

  return {
    selectedNodeId,
    setSelectedNodeId,
    selectedNode,
    onConnect,
    onDrop,
    onDragOver,
    onDragStart,
    onNodeClick,
    onPaneClick,
    handleUpdateNodeData,
    handleAutoArrange,
  };
}
