import type { Node, Edge } from '@xyflow/react';

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  nodes: Node[];
  edges: Edge[];
}

export const workflowTemplates: WorkflowTemplate[] = [
  {
    id: 'prompt-chaining',
    name: 'Prompt Chaining',
    description: 'Sequential agents, each refines the previous output',
    icon: '🔗',
    nodes: [
      {
        id: 'supervisor-1',
        type: 'supervisor',
        position: { x: 50, y: 200 },
        data: { label: 'Supervisor', status: 'idle', history: [] },
      },
      {
        id: 'agent-1',
        type: 'agent',
        position: { x: 350, y: 100 },
        data: { label: 'Draft', status: 'idle', agent: null, outputType: 'code', outputSchema: '{"language": "typescript"}' },
      },
      {
        id: 'agent-2',
        type: 'agent',
        position: { x: 600, y: 100 },
        data: { label: 'Refine', status: 'idle', agent: null, outputType: 'code', outputSchema: '{"hasComments": true}' },
      },
      {
        id: 'agent-3',
        type: 'agent',
        position: { x: 850, y: 100 },
        data: { label: 'Polish', status: 'idle', agent: null, outputType: 'markdown' },
      },
      {
        id: 'output-1',
        type: 'output',
        position: { x: 1100, y: 200 },
        data: { label: 'Output', results: [], status: 'idle' },
      },
    ],
    edges: [
      { id: 'e1', source: 'supervisor-1', target: 'agent-1', animated: true },
      { id: 'e2', source: 'agent-1', target: 'agent-2', animated: true },
      { id: 'e3', source: 'agent-2', target: 'agent-3', animated: true },
      { id: 'e4', source: 'agent-3', target: 'output-1', animated: true },
    ],
  },
  {
    id: 'parallelization',
    name: 'Parallelization',
    description: 'Fan-out to multiple agents, aggregate results',
    icon: '⚡',
    nodes: [
      {
        id: 'supervisor-1',
        type: 'supervisor',
        position: { x: 50, y: 200 },
        data: { label: 'Supervisor', status: 'idle', history: [] },
      },
      {
        id: 'agent-1',
        type: 'agent',
        position: { x: 350, y: 50 },
        data: { label: 'Analysis', status: 'idle', agent: null, outputType: 'json', outputSchema: '{"type":"object","required":["analysis","recommendations"]}' },
      },
      {
        id: 'agent-2',
        type: 'agent',
        position: { x: 350, y: 200 },
        data: { label: 'Implementation', status: 'idle', agent: null, outputType: 'code', outputSchema: '{"language":"typescript"}' },
      },
      {
        id: 'agent-3',
        type: 'agent',
        position: { x: 350, y: 350 },
        data: { label: 'Testing', status: 'idle', agent: null, outputType: 'code', outputSchema: '{"language":"typescript","hasTests":true}' },
      },
      {
        id: 'aggregator-1',
        type: 'aggregator',
        position: { x: 650, y: 200 },
        data: { label: 'Aggregator', status: 'idle', inputs: [] },
      },
      {
        id: 'output-1',
        type: 'output',
        position: { x: 900, y: 200 },
        data: { label: 'Output', results: [], status: 'idle' },
      },
    ],
    edges: [
      { id: 'e1', source: 'supervisor-1', target: 'agent-1', animated: true },
      { id: 'e2', source: 'supervisor-1', target: 'agent-2', animated: true },
      { id: 'e3', source: 'supervisor-1', target: 'agent-3', animated: true },
      { id: 'e4', source: 'agent-1', target: 'aggregator-1', targetHandle: 'input-0', animated: true },
      { id: 'e5', source: 'agent-2', target: 'aggregator-1', targetHandle: 'input-1', animated: true },
      { id: 'e6', source: 'agent-3', target: 'aggregator-1', targetHandle: 'input-2', animated: true },
      { id: 'e7', source: 'aggregator-1', target: 'output-1', animated: true },
    ],
  },
  {
    id: 'routing',
    name: 'Routing',
    description: 'Classifier routes to specialist agent',
    icon: '🔀',
    nodes: [
      {
        id: 'supervisor-1',
        type: 'supervisor',
        position: { x: 50, y: 200 },
        data: { label: 'Supervisor', status: 'idle', history: [] },
      },
      {
        id: 'router-1',
        type: 'router',
        position: { x: 300, y: 200 },
        data: { label: 'Router', status: 'idle', routes: ['Code', 'Debug', 'Explain'] },
      },
      {
        id: 'agent-code',
        type: 'agent',
        position: { x: 550, y: 50 },
        data: { label: 'Coder', status: 'idle', agent: null, outputType: 'code', outputSchema: '{"hasComments":true}' },
      },
      {
        id: 'agent-debug',
        type: 'agent',
        position: { x: 550, y: 200 },
        data: { label: 'Debugger', status: 'idle', agent: null, outputType: 'json', outputSchema: '{"type":"object","required":["issue","fix"]}' },
      },
      {
        id: 'agent-explain',
        type: 'agent',
        position: { x: 550, y: 350 },
        data: { label: 'Explainer', status: 'idle', agent: null, outputType: 'markdown', outputSchema: '{"hasHeaders":true}' },
      },
      {
        id: 'output-1',
        type: 'output',
        position: { x: 850, y: 200 },
        data: { label: 'Output', results: [], status: 'idle' },
      },
    ],
    edges: [
      { id: 'e1', source: 'supervisor-1', target: 'router-1', animated: true },
      { id: 'e2', source: 'router-1', sourceHandle: 'route-0', target: 'agent-code', animated: true, style: { stroke: '#3b82f6' } },
      { id: 'e3', source: 'router-1', sourceHandle: 'route-1', target: 'agent-debug', animated: true, style: { stroke: '#8b5cf6' } },
      { id: 'e4', source: 'router-1', sourceHandle: 'route-2', target: 'agent-explain', animated: true, style: { stroke: '#f97316' } },
      { id: 'e5', source: 'agent-code', target: 'output-1', animated: true },
      { id: 'e6', source: 'agent-debug', target: 'output-1', animated: true },
      { id: 'e7', source: 'agent-explain', target: 'output-1', animated: true },
    ],
  },
  {
    id: 'orchestrator-worker',
    name: 'Orchestrator-Worker',
    description: 'Orchestrator assigns tasks, synthesizer combines',
    icon: '👔',
    nodes: [
      {
        id: 'supervisor-1',
        type: 'supervisor',
        position: { x: 50, y: 200 },
        data: { label: 'Orchestrator', status: 'idle', history: [] },
      },
      {
        id: 'agent-1',
        type: 'agent',
        position: { x: 350, y: 50 },
        data: { label: 'Worker 1', status: 'idle', agent: null, outputType: 'json', outputSchema: '{"type":"object","required":["task","result"]}' },
      },
      {
        id: 'agent-2',
        type: 'agent',
        position: { x: 350, y: 200 },
        data: { label: 'Worker 2', status: 'idle', agent: null, outputType: 'json', outputSchema: '{"type":"object","required":["task","result"]}' },
      },
      {
        id: 'agent-3',
        type: 'agent',
        position: { x: 350, y: 350 },
        data: { label: 'Worker 3', status: 'idle', agent: null, outputType: 'json', outputSchema: '{"type":"object","required":["task","result"]}' },
      },
      {
        id: 'synthesizer-1',
        type: 'agent',
        position: { x: 650, y: 200 },
        data: { label: 'Synthesizer', status: 'idle', agent: null, outputType: 'markdown', outputSchema: '{"hasHeaders":true}' },
      },
      {
        id: 'output-1',
        type: 'output',
        position: { x: 950, y: 200 },
        data: { label: 'Output', results: [], status: 'idle' },
      },
    ],
    edges: [
      { id: 'e1', source: 'supervisor-1', target: 'agent-1', animated: true },
      { id: 'e2', source: 'supervisor-1', target: 'agent-2', animated: true },
      { id: 'e3', source: 'supervisor-1', target: 'agent-3', animated: true },
      { id: 'e4', source: 'agent-1', target: 'synthesizer-1', animated: true },
      { id: 'e5', source: 'agent-2', target: 'synthesizer-1', animated: true },
      { id: 'e6', source: 'agent-3', target: 'synthesizer-1', animated: true },
      { id: 'e7', source: 'synthesizer-1', target: 'output-1', animated: true },
    ],
  },
  {
    id: 'evaluator-optimizer',
    name: 'Evaluator-Optimizer',
    description: 'Generator + Evaluator with rejection loop',
    icon: '🔄',
    nodes: [
      {
        id: 'supervisor-1',
        type: 'supervisor',
        position: { x: 50, y: 200 },
        data: { label: 'Supervisor', status: 'idle', history: [] },
      },
      {
        id: 'generator-1',
        type: 'agent',
        position: { x: 350, y: 200 },
        data: { label: 'Generator', status: 'idle', agent: null, outputType: 'code', outputSchema: '{"language":"typescript","hasTests":true}' },
      },
      {
        id: 'evaluator-1',
        type: 'evaluator',
        position: { x: 650, y: 200 },
        data: { label: 'Evaluator', status: 'idle', iteration: 0, maxIterations: 3 },
      },
      {
        id: 'output-1',
        type: 'output',
        position: { x: 950, y: 200 },
        data: { label: 'Output', results: [], status: 'idle' },
      },
    ],
    edges: [
      { id: 'e1', source: 'supervisor-1', target: 'generator-1', animated: true },
      { id: 'e2', source: 'generator-1', target: 'evaluator-1', animated: true },
      { id: 'e3', source: 'evaluator-1', sourceHandle: 'approved', target: 'output-1', animated: true, style: { stroke: '#22c55e' } },
      { id: 'e4', source: 'evaluator-1', sourceHandle: 'rejected', target: 'generator-1', animated: true, style: { stroke: '#ef4444' } },
    ],
  },
  {
    id: 'agent-loop',
    name: 'Agent Loop',
    description: 'Autonomous agent with tool feedback loop',
    icon: '🤖',
    nodes: [
      {
        id: 'supervisor-1',
        type: 'supervisor',
        position: { x: 50, y: 200 },
        data: { label: 'Supervisor', status: 'idle', history: [] },
      },
      {
        id: 'agent-1',
        type: 'agent',
        position: { x: 400, y: 200 },
        data: { label: 'Autonomous', status: 'idle', agent: null, outputType: 'json', outputSchema: '{"type":"object","required":["status","result"]}' },
      },
      {
        id: 'output-1',
        type: 'output',
        position: { x: 750, y: 200 },
        data: { label: 'Output', results: [], status: 'idle' },
      },
    ],
    edges: [
      { id: 'e1', source: 'supervisor-1', target: 'agent-1', animated: true },
      { id: 'e2', source: 'agent-1', target: 'output-1', animated: true },
    ],
  },
];

export function getTemplateById(id: string): WorkflowTemplate | undefined {
  return workflowTemplates.find(t => t.id === id);
}
