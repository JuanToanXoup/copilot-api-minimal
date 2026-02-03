import type { Node, Edge } from '@xyflow/react';
import type { PromptBlockNodeData } from './types';

export interface PromptWorkflowTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  nodes: Node[];
  edges: Edge[];
}

// Helper to create PromptBlock node data with new reference-based format
function createPromptBlockData(
  label: string,
  promptTemplateId: string | null = null
): Record<string, unknown> {
  const data: PromptBlockNodeData = {
    label,
    agentId: null, // User selects agent
    promptTemplateId, // Reference to template in registry
    variableBindings: [],
    status: 'idle',
  };
  return data as unknown as Record<string, unknown>;
}

export const promptWorkflowTemplates: PromptWorkflowTemplate[] = [
  {
    id: 'simple-chain',
    name: 'Simple Chain',
    description: 'Sequential prompt blocks - select templates from the registry',
    icon: '🔗',
    nodes: [
      {
        id: 'start-1',
        type: 'workflowStart',
        position: { x: 50, y: 200 },
        data: { label: 'Start' },
      },
      {
        id: 'prompt-1',
        type: 'promptBlock',
        position: { x: 400, y: 200 },
        data: createPromptBlockData('First Step', 'custom'),
      },
      {
        id: 'prompt-2',
        type: 'promptBlock',
        position: { x: 900, y: 200 },
        data: createPromptBlockData('Refine', 'custom'),
      },
      {
        id: 'output-1',
        type: 'output',
        position: { x: 1400, y: 200 },
        data: { label: 'Output', results: [], status: 'idle' },
      },
    ],
    edges: [
      { id: 'e1', source: 'start-1', target: 'prompt-1', animated: true },
      { id: 'e2', source: 'prompt-1', target: 'prompt-2', animated: true },
      { id: 'e3', source: 'prompt-2', target: 'output-1', animated: true },
    ],
  },
  {
    id: 'self-healing-test',
    name: 'Self-Healing Pipeline',
    description: 'Classify → Analyze → Fix test failures',
    icon: '🔧',
    nodes: [
      {
        id: 'start-1',
        type: 'workflowStart',
        position: { x: 50, y: 200 },
        data: { label: 'Failure Input' },
      },
      {
        id: 'classifier',
        type: 'promptBlock',
        position: { x: 400, y: 200 },
        data: createPromptBlockData('Classify Failure', 'classify-failure'),
      },
      {
        id: 'fix-generator',
        type: 'promptBlock',
        position: { x: 900, y: 200 },
        data: createPromptBlockData('Generate Fix', 'generate-fix'),
      },
      {
        id: 'output-1',
        type: 'output',
        position: { x: 1400, y: 200 },
        data: { label: 'Result', results: [], status: 'idle' },
      },
    ],
    edges: [
      { id: 'e1', source: 'start-1', target: 'classifier', animated: true },
      { id: 'e2', source: 'classifier', target: 'fix-generator', animated: true },
      { id: 'e3', source: 'fix-generator', target: 'output-1', animated: true },
    ],
  },
  {
    id: 'code-review',
    name: 'Code Review',
    description: 'Review code with multiple parallel checks',
    icon: '🔍',
    nodes: [
      {
        id: 'start-1',
        type: 'workflowStart',
        position: { x: 50, y: 200 },
        data: { label: 'Code Input' },
      },
      {
        id: 'review',
        type: 'promptBlock',
        position: { x: 400, y: 200 },
        data: createPromptBlockData('Review Code', 'review-code'),
      },
      {
        id: 'output-1',
        type: 'output',
        position: { x: 900, y: 200 },
        data: { label: 'Review Report', results: [], status: 'idle' },
      },
    ],
    edges: [
      { id: 'e1', source: 'start-1', target: 'review', animated: true },
      { id: 'e2', source: 'review', target: 'output-1', animated: true },
    ],
  },
  {
    id: 'blank',
    name: 'Blank Workflow',
    description: 'Start from scratch - add blocks from the canvas',
    icon: '📝',
    nodes: [
      {
        id: 'start-1',
        type: 'workflowStart',
        position: { x: 50, y: 200 },
        data: { label: 'Start' },
      },
      {
        id: 'output-1',
        type: 'output',
        position: { x: 900, y: 200 },
        data: { label: 'Output', results: [], status: 'idle' },
      },
    ],
    edges: [],
  },
];

export function getPromptWorkflowTemplateById(id: string): PromptWorkflowTemplate | undefined {
  return promptWorkflowTemplates.find((t) => t.id === id);
}
