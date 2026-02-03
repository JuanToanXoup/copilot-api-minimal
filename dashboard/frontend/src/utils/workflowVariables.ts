import type { Node, Edge } from '@xyflow/react';
import type {
  PromptBlockData,
  VariableBinding,
  OutputExtraction,
  ExtractionMode,
} from '../components/PromptBlockNode';

// Context holding all variable values during workflow execution
export interface WorkflowContext {
  input: string; // Original workflow input
  nodeOutputs: Record<string, Record<string, unknown>>; // nodeId -> { outputName: value }
}

// Substitute {{variables}} in template using context and bindings
export function substituteVariables(
  template: string,
  bindings: VariableBinding[],
  context: WorkflowContext,
  upstreamNodeIds: string[]
): string {
  let result = template;

  // Find all {{variable}} patterns
  const regex = /\{\{(\w+)\}\}/g;
  let match;

  while ((match = regex.exec(template)) !== null) {
    const varName = match[1];
    const fullMatch = match[0];
    const binding = bindings.find((b) => b.name === varName);

    let value = '';

    if (binding) {
      switch (binding.source) {
        case 'input':
          value = context.input;
          break;
        case 'static':
          value = binding.staticValue || '';
          break;
        case 'upstream':
          // Get from upstream node outputs
          value = getUpstreamValue(
            context,
            upstreamNodeIds,
            binding.sourceNodeId,
            binding.sourcePath
          );
          break;
      }
    } else {
      // Default behavior: try to get from upstream nodes or use input
      if (varName === 'input') {
        value = context.input;
      } else if (varName === 'previous_output') {
        // Get the most recent upstream output
        value = getUpstreamValue(context, upstreamNodeIds);
      } else {
        // Try to find in any upstream outputs
        for (const nodeId of upstreamNodeIds) {
          const nodeOutputs = context.nodeOutputs[nodeId];
          if (nodeOutputs && varName in nodeOutputs) {
            value = String(nodeOutputs[varName]);
            break;
          }
        }
      }
    }

    result = result.replace(fullMatch, value);
  }

  return result;
}

// Get value from upstream node outputs
function getUpstreamValue(
  context: WorkflowContext,
  upstreamNodeIds: string[],
  specificNodeId?: string,
  path?: string
): string {
  // If specific node requested
  if (specificNodeId) {
    const outputs = context.nodeOutputs[specificNodeId];
    if (outputs) {
      if (path) {
        return extractByPath(outputs, path);
      }
      // Return first output or 'output' key
      if ('output' in outputs) return String(outputs.output);
      const firstKey = Object.keys(outputs)[0];
      if (firstKey) return String(outputs[firstKey]);
    }
    return '';
  }

  // Get from most recent upstream node
  for (const nodeId of [...upstreamNodeIds].reverse()) {
    const outputs = context.nodeOutputs[nodeId];
    if (outputs) {
      if (path) {
        return extractByPath(outputs, path);
      }
      if ('output' in outputs) return String(outputs.output);
      const firstKey = Object.keys(outputs)[0];
      if (firstKey) return String(outputs[firstKey]);
    }
  }

  return '';
}

// Extract value using JSON path (simplified)
function extractByPath(obj: Record<string, unknown>, path: string): string {
  // Simple JSON path support: $.key.subkey or just key.subkey
  const cleanPath = path.replace(/^\$\.?/, '');
  const parts = cleanPath.split('.');

  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return '';
    if (typeof current === 'object' && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return '';
    }
  }

  if (typeof current === 'object') {
    return JSON.stringify(current);
  }
  return String(current ?? '');
}

// Extract outputs from response based on extraction config
export function extractOutputs(
  response: string,
  extractions: OutputExtraction[]
): Record<string, unknown> {
  const outputs: Record<string, unknown> = {};

  // If no extractions defined, create default 'output' with full response
  if (!extractions || extractions.length === 0) {
    outputs.output = response;
    return outputs;
  }

  for (const extraction of extractions) {
    try {
      const value = extractValue(response, extraction.mode, extraction.pattern);
      outputs[extraction.outputName] = value;
    } catch {
      outputs[extraction.outputName] = response;
    }
  }

  return outputs;
}

// Extract value using specified mode
function extractValue(
  response: string,
  mode: ExtractionMode,
  pattern?: string
): unknown {
  switch (mode) {
    case 'full':
      return response;

    case 'json':
      // Try to parse as JSON
      try {
        // Find JSON in response (may have surrounding text)
        const jsonMatch = response.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        return JSON.parse(response);
      } catch {
        return response;
      }

    case 'jsonpath':
      // Parse JSON then extract path
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(response);
        if (pattern) {
          return extractByPath(parsed as Record<string, unknown>, pattern);
        }
        return parsed;
      } catch {
        return response;
      }

    case 'regex':
      // Extract using regex
      if (pattern) {
        try {
          const regex = new RegExp(pattern);
          const match = response.match(regex);
          if (match) {
            return match[1] || match[0]; // Return capture group or full match
          }
        } catch {
          // Invalid regex
        }
      }
      return response;

    case 'first_line':
      return response.split('\n')[0].trim();

    default:
      return response;
  }
}

// Get upstream node IDs for a given node
export function getUpstreamNodeIds(
  nodeId: string,
  _nodes: Node[],
  edges: Edge[]
): string[] {
  const upstreamIds: string[] = [];
  const visited = new Set<string>();

  function traverse(currentId: string) {
    if (visited.has(currentId)) return;
    visited.add(currentId);

    // Find edges where this node is the target
    const incomingEdges = edges.filter((e) => e.target === currentId);
    for (const edge of incomingEdges) {
      if (edge.source !== nodeId) {
        upstreamIds.push(edge.source);
        traverse(edge.source);
      }
    }
  }

  traverse(nodeId);
  return upstreamIds;
}

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

// Check if a node is a PromptBlock
export function isPromptBlock(node: Node): boolean {
  return node.type === 'promptBlock';
}

// Get PromptBlock data with defaults
export function getPromptBlockData(node: Node): PromptBlockData {
  const data = node.data as Partial<PromptBlockData>;
  return {
    label: data.label || 'Prompt Block',
    promptTemplate: data.promptTemplate || '',
    variableBindings: data.variableBindings || [],
    outputExtractions: data.outputExtractions || [],
    agent: data.agent || null,
    status: data.status || 'idle',
    prompt: data.prompt,
    response: data.response,
    extractedOutputs: data.extractedOutputs,
  };
}
