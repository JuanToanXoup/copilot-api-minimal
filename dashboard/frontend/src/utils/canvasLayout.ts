import type { Node, Edge } from '@xyflow/react';

interface LayoutOptions {
  horizontalSpacing: number;
  verticalSpacing: number;
  startX: number;
  startY: number;
}

const defaultOptions: LayoutOptions = {
  horizontalSpacing: 280,
  verticalSpacing: 100,
  startX: 50,
  startY: 50,
};

/**
 * Assign hierarchical levels to nodes using BFS from root nodes
 */
function assignLevels(nodes: Node[], edges: Edge[]): Map<string, number> {
  const levels = new Map<string, number>();
  const incomingEdges = new Map<string, string[]>();
  const outgoingEdges = new Map<string, string[]>();

  // Build edge maps
  for (const node of nodes) {
    incomingEdges.set(node.id, []);
    outgoingEdges.set(node.id, []);
  }

  for (const edge of edges) {
    const incoming = incomingEdges.get(edge.target) || [];
    incoming.push(edge.source);
    incomingEdges.set(edge.target, incoming);

    const outgoing = outgoingEdges.get(edge.source) || [];
    outgoing.push(edge.target);
    outgoingEdges.set(edge.source, outgoing);
  }

  // Find root nodes (no incoming edges, or special types like 'prompt', 'supervisor', 'workflowStart')
  const rootNodes = nodes.filter(node => {
    const incoming = incomingEdges.get(node.id) || [];
    return incoming.length === 0 ||
           node.type === 'prompt' ||
           node.type === 'supervisor' ||
           node.type === 'workflowStart';
  });

  // BFS to assign levels
  const queue: Array<{ id: string; level: number }> = [];

  for (const root of rootNodes) {
    queue.push({ id: root.id, level: 0 });
    levels.set(root.id, 0);
  }

  while (queue.length > 0) {
    const { id, level } = queue.shift()!;
    const children = outgoingEdges.get(id) || [];

    for (const childId of children) {
      const existingLevel = levels.get(childId);
      const newLevel = level + 1;

      // Only update if we haven't visited or found a longer path
      if (existingLevel === undefined || newLevel > existingLevel) {
        levels.set(childId, newLevel);
        queue.push({ id: childId, level: newLevel });
      }
    }
  }

  // Handle orphan nodes (no edges)
  for (const node of nodes) {
    if (!levels.has(node.id)) {
      // Place orphans at level 0
      levels.set(node.id, 0);
    }
  }

  return levels;
}

/**
 * Group nodes by their assigned level
 */
function groupByLevel(nodes: Node[], levels: Map<string, number>): Map<number, Node[]> {
  const groups = new Map<number, Node[]>();

  for (const node of nodes) {
    const level = levels.get(node.id) ?? 0;
    const group = groups.get(level) || [];
    group.push(node);
    groups.set(level, group);
  }

  return groups;
}

/**
 * Get actual dimensions of a node based on its type
 * These match the w-[] and estimated heights in the component files
 */
function getNodeDimensions(node: Node): { width: number; height: number } {
  switch (node.type) {
    case 'workflowStart':
      return { width: 280, height: 180 };
    case 'promptBlock':
    case 'httpRequest':
    case 'output':
      return { width: 200, height: 80 };
    case 'condition':
    case 'evaluator':
      return { width: 200, height: 100 }; // Slightly taller due to branch indicators
    case 'router':
    case 'aggregator':
      return { width: 200, height: 80 };
    // Legacy nodes
    case 'prompt':
      return { width: 320, height: 150 };
    case 'supervisor':
      return { width: 380, height: 200 };
    case 'agent':
      return { width: 280, height: 150 };
    default:
      return { width: 200, height: 80 };
  }
}

// Backwards compatibility wrapper
function getNodeHeight(node: Node): number {
  return getNodeDimensions(node).height;
}

function getNodeWidth(node: Node): number {
  return getNodeDimensions(node).width;
}

/**
 * Calculate hierarchical layout positions for nodes (left-to-right tree)
 * Returns new nodes with updated positions
 * Uses actual node dimensions for proper spacing
 */
export function getHierarchicalLayout(
  nodes: Node[],
  edges: Edge[],
  options: Partial<LayoutOptions> = {}
): Node[] {
  if (nodes.length === 0) return nodes;

  const opts = { ...defaultOptions, ...options };
  const levels = assignLevels(nodes, edges);
  const groups = groupByLevel(nodes, levels);

  // Sort levels
  const sortedLevels = Array.from(groups.keys()).sort((a, b) => a - b);

  // Calculate max width per level for proper horizontal spacing
  const levelWidths = new Map<number, number>();
  for (const level of sortedLevels) {
    const nodesAtLevel = groups.get(level) || [];
    const maxWidth = Math.max(...nodesAtLevel.map(n => getNodeWidth(n)));
    levelWidths.set(level, maxWidth);
  }

  // Calculate x positions based on cumulative widths
  const levelXPositions = new Map<number, number>();
  let currentX = opts.startX;
  for (const level of sortedLevels) {
    levelXPositions.set(level, currentX);
    const levelWidth = levelWidths.get(level) || 200;
    currentX += levelWidth + 80; // 80px gap between columns
  }

  // Calculate positions
  const newNodes: Node[] = [];

  for (const level of sortedLevels) {
    const nodesAtLevel = groups.get(level) || [];
    const x = levelXPositions.get(level) || opts.startX;

    // Sort nodes at each level by type priority for consistent ordering
    const typePriority: Record<string, number> = {
      workflowStart: 0,
      promptBlock: 1,
      prompt: 2,
      supervisor: 3,
      router: 4,
      agent: 5,
      aggregator: 6,
      evaluator: 7,
      output: 8,
    };

    nodesAtLevel.sort((a, b) => {
      const priorityA = typePriority[a.type || ''] ?? 10;
      const priorityB = typePriority[b.type || ''] ?? 10;
      return priorityA - priorityB;
    });

    // Calculate total height needed for this column
    let totalHeight = 0;
    for (const node of nodesAtLevel) {
      totalHeight += getNodeHeight(node) + opts.verticalSpacing;
    }
    totalHeight -= opts.verticalSpacing; // Remove extra spacing after last node

    // Center the column vertically
    let currentY = opts.startY - totalHeight / 2 + 150; // Offset to keep mostly visible

    for (const node of nodesAtLevel) {
      newNodes.push({
        ...node,
        position: { x, y: currentY },
      });
      currentY += getNodeHeight(node) + opts.verticalSpacing;
    }
  }

  return newNodes;
}

/**
 * Check if nodes have overlapping positions
 */
export function hasOverlappingNodes(nodes: Node[]): boolean {
  const nodeWidth = 300;
  const nodeHeight = 150;

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];

      const xOverlap = Math.abs(a.position.x - b.position.x) < nodeWidth;
      const yOverlap = Math.abs(a.position.y - b.position.y) < nodeHeight;

      if (xOverlap && yOverlap) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Simple grid layout for disconnected nodes
 */
export function getGridLayout(
  nodes: Node[],
  options: { columns?: number; spacing?: number; startX?: number; startY?: number } = {}
): Node[] {
  const {
    columns = 3,
    spacing = 200,
    startX = 50,
    startY = 50,
  } = options;

  return nodes.map((node, index) => ({
    ...node,
    position: {
      x: startX + (index % columns) * spacing,
      y: startY + Math.floor(index / columns) * spacing,
    },
  }));
}
