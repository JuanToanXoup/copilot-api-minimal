import type { Node, Edge } from '@xyflow/react';

// Get execution order for workflow (topological sort)
export function getExecutionOrder(
  nodes: Node[],
  edges: Edge[],
  startNodeId?: string
): string[] {
  const order: string[] = [];
  const visited = new Set<string>();
  const inDegree = new Map<string, number>();

  // Calculate in-degree for each node
  for (const node of nodes) {
    inDegree.set(node.id, 0);
  }
  for (const edge of edges) {
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  }

  // Find starting nodes (in-degree 0 or specified start)
  const queue: string[] = [];
  if (startNodeId) {
    queue.push(startNodeId);
  } else {
    for (const node of nodes) {
      if (inDegree.get(node.id) === 0) {
        queue.push(node.id);
      }
    }
  }

  // BFS traversal
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);
    order.push(nodeId);

    // Find downstream nodes
    const outgoingEdges = edges.filter((e) => e.source === nodeId);
    for (const edge of outgoingEdges) {
      const newDegree = (inDegree.get(edge.target) || 1) - 1;
      inDegree.set(edge.target, newDegree);
      if (newDegree === 0) {
        queue.push(edge.target);
      }
    }
  }

  return order;
}
