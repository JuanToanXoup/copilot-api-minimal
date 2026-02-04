import type { VariableBinding, Agent } from '../types';

/**
 * Substitute variables in a template string
 * - {{input}} always comes from workflow start
 * - Any other variable auto-resolves to the most recent upstream output
 * - Static bindings override auto-resolution
 */
export function substituteTemplateVariables(
  template: string,
  bindings: VariableBinding[],
  workflowInput: string,
  nodeOutputs: Record<string, unknown>
): string {
  let result = template;
  const variableRegex = /\{\{(\w+)\}\}/g;

  // Get all upstream outputs as a flat list (most recent first)
  const upstreamValues: string[] = [];
  for (const nodeId of Object.keys(nodeOutputs).reverse()) {
    const outputs = nodeOutputs[nodeId];
    if (outputs && typeof outputs === 'object') {
      const outputObj = outputs as Record<string, unknown>;
      // Get the first value from this node's outputs
      const firstKey = Object.keys(outputObj)[0];
      if (firstKey) {
        const value = outputObj[firstKey];
        const strValue = typeof value === 'string' ? value : JSON.stringify(value);
        upstreamValues.push(strValue);
      }
    }
  }

  result = result.replace(variableRegex, (_match, varName) => {
    // {{input}} always comes from workflow start
    if (varName === 'input') {
      return workflowInput;
    }

    // Check for static binding override
    const binding = bindings.find((b) => b.variableName === varName);
    if (binding?.source === 'static') {
      return binding.staticValue || '';
    }

    // Auto-resolve: First try exact name match in upstream outputs
    for (const nodeId of Object.keys(nodeOutputs)) {
      const outputs = nodeOutputs[nodeId];
      if (outputs && typeof outputs === 'object') {
        const outputObj = outputs as Record<string, unknown>;
        if (varName in outputObj) {
          const value = outputObj[varName];
          return typeof value === 'string' ? value : JSON.stringify(value);
        }
      }
    }

    // Auto-resolve: If no exact match, use the most recent upstream output
    // This allows {{code}}, {{analysis}}, etc. to all resolve to upstream data
    if (upstreamValues.length > 0) {
      return upstreamValues[0];
    }

    // Last resort: if no upstream, use workflow input for any variable
    // This handles templates that use {{code}} when input is actually {{input}}
    return workflowInput;
  });

  return result;
}

/**
 * Extract output from response based on template config
 */
export function extractTemplateOutput(
  response: string,
  mode: string,
  pattern?: string
): unknown {
  switch (mode) {
    case 'json':
      try {
        return JSON.parse(response);
      } catch {
        return response;
      }
    case 'jsonpath':
      // Simple JSONPath implementation for common cases
      if (pattern) {
        try {
          const json = JSON.parse(response);
          const path = pattern.replace(/^\$\.?/, '').split('.');
          let value: unknown = json;
          for (const key of path) {
            if (value && typeof value === 'object') {
              value = (value as Record<string, unknown>)[key];
            } else {
              return response;
            }
          }
          return value;
        } catch {
          return response;
        }
      }
      return response;
    case 'regex':
      if (pattern) {
        const match = response.match(new RegExp(pattern));
        return match ? match[1] || match[0] : response;
      }
      return response;
    case 'first_line':
      return response.split('\n')[0];
    case 'full':
    default:
      return response;
  }
}

/**
 * Get workflow order by traversing edges from prompt node
 */
export function getWorkflowOrder(
  nodes: Array<{ id: string; type?: string }>,
  edges: Array<{ source: string; target: string }>
): Array<{ id: string; type?: string }> {
  const order: Array<{ id: string; type?: string }> = [];
  const visited = new Set<string>();

  const promptNode = nodes.find((n) => n.type === 'prompt');
  if (!promptNode) return order;

  const queue: string[] = [promptNode.id];
  visited.add(promptNode.id);

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentNode = nodes.find((n) => n.id === currentId);

    if (currentNode?.type === 'agent') {
      order.push(currentNode);
    }

    const connectedEdges = edges.filter((e) => e.source === currentId);
    for (const edge of connectedEdges) {
      if (!visited.has(edge.target)) {
        visited.add(edge.target);
        queue.push(edge.target);
      }
    }
  }

  return order;
}

/**
 * Helper to safely access agent from node data
 */
export function getAgentFromNode(node: { data?: unknown }): Agent | null {
  const data = node.data as { agent?: Agent };
  return data?.agent || null;
}
