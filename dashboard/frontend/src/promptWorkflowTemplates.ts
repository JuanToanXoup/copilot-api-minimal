import type { Node, Edge } from '@xyflow/react';
import type { PromptBlockData } from './components/PromptBlockNode';

export interface PromptWorkflowTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  nodes: Node[];
  edges: Edge[];
}

// Helper to create PromptBlock node data
function createPromptBlockData(
  label: string,
  promptTemplate: string,
  outputExtractions: PromptBlockData['outputExtractions'] = []
): Partial<PromptBlockData> {
  return {
    label,
    promptTemplate,
    variableBindings: [],
    outputExtractions:
      outputExtractions.length > 0
        ? outputExtractions
        : [{ mode: 'full', outputName: 'output' }],
    agent: null,
    status: 'idle',
  };
}

export const promptWorkflowTemplates: PromptWorkflowTemplate[] = [
  {
    id: 'simple-chain',
    name: 'Simple Chain',
    description: 'Sequential prompt blocks, each refines the previous',
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
        position: { x: 300, y: 200 },
        data: createPromptBlockData(
          'First Step',
          `You are a helpful assistant.

Task: {{input}}

Provide a clear and detailed response.`
        ),
      },
      {
        id: 'prompt-2',
        type: 'promptBlock',
        position: { x: 600, y: 200 },
        data: createPromptBlockData(
          'Refine',
          `Review and improve the following:

{{previous_output}}

Make it more concise and actionable.`
        ),
      },
      {
        id: 'output-1',
        type: 'output',
        position: { x: 900, y: 200 },
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
    name: 'BDD Gherkin Self-Healing',
    description: 'Full 6-agent pipeline: Classify → Inspect → Fix → Validate',
    icon: '🔧',
    nodes: [
      {
        id: 'start-1',
        type: 'workflowStart',
        position: { x: 50, y: 250 },
        data: { label: 'Failure Input' },
      },
      // === CLASSIFIER ===
      {
        id: 'classifier',
        type: 'promptBlock',
        position: { x: 300, y: 100 },
        data: createPromptBlockData(
          'Classifier',
          `You are a BDD Gherkin test failure classifier.

## Input
- Error message: {{error_message}}
- Stack trace: {{stack_trace}}
- Test file: {{test_file}}

## Failure Types
| Type | Description |
|------|-------------|
| LOCATOR | CSS/XPath selector no longer matches DOM |
| TIMING | Element not ready when test interacts |
| ASSERTION | Expected text/value changed |
| ENVIRONMENT | URL, auth, config, or service issue |
| DATA | Test data stale or missing |
| UNKNOWN | Cannot determine |

## Task
Categorize this failure into one of the types above.

## Output Contract
Respond with valid JSON only:
{
  "failure_type": "LOCATOR | TIMING | ASSERTION | ENVIRONMENT | DATA | UNKNOWN",
  "confidence": "HIGH | MEDIUM | LOW",
  "reasoning": "Brief explanation of why this classification"
}`,
          [{ mode: 'json', outputName: 'classification' }]
        ),
      },
      // === INSPECTION PLANNER ===
      {
        id: 'inspection-planner',
        type: 'promptBlock',
        position: { x: 300, y: 400 },
        data: createPromptBlockData(
          'Inspection Planner',
          `You are an Inspection Planner for BDD Gherkin test failures.

## Error Context
- Error: {{error_message}}
- Test file: {{test_file}}
- URL: {{url}}
- Failing selector: {{selector}}

## Task
Plan browser actions to diagnose the failure. Generate Selenium MCP CLI commands that the orchestrator will execute.

Available tools:
- navigate: Go to a URL
- find_element: Check if element exists (by: css|xpath|id, value: selector)
- get_element_text: Get text content of element
- take_screenshot: Capture current page
- click_element: Click an element

## Output Contract
Respond with valid JSON only:
{
  "commands": [
    { "tool": "navigate", "params": { "url": "..." } },
    { "tool": "find_element", "params": { "by": "css", "value": "..." } },
    { "tool": "find_element", "params": { "by": "css", "value": "..." } },
    { "tool": "take_screenshot", "params": {} }
  ]
}`,
          [{ mode: 'json', outputName: 'inspection_commands' }]
        ),
      },
      // === INSPECTION ANALYZER ===
      {
        id: 'inspection-analyzer',
        type: 'promptBlock',
        position: { x: 600, y: 250 },
        data: createPromptBlockData(
          'Inspection Analyzer',
          `You are an Inspection Analyzer for BDD Gherkin test failures.

## Classification
{{classification}}

## Browser Inspection Results
{{browser_results}}

## Original Error
- Error: {{error_message}}
- Failing selector: {{selector}}

## Task
Interpret the browser inspection results:
1. Which selectors worked vs failed?
2. What is the root cause?
3. What is the most stable selector to use?

Selector stability preference: data-testid > id > css class > xpath

## Output Contract
Respond with valid JSON only:
{
  "diagnosis": "Clear description of what's wrong",
  "working_selector": "The selector that works, or null",
  "selector_strategy": "css | xpath | data-testid | id | name | null",
  "confidence": "HIGH | MEDIUM | LOW",
  "needs_more_inspection": false
}`,
          [{ mode: 'json', outputName: 'diagnosis' }]
        ),
      },
      // === FIX GENERATOR ===
      {
        id: 'fix-generator',
        type: 'promptBlock',
        position: { x: 900, y: 150 },
        data: createPromptBlockData(
          'Fix Generator',
          `You are a Fix Generator for BDD Gherkin test failures.

## Diagnosis
{{diagnosis}}

## Original Error
- Error: {{error_message}}
- Test file: {{test_file}}

## Fix Constraints
1. Minimal changes only — fix the broken locator/timing/assertion, nothing else
2. Never delete or skip tests — no @Disabled, @Ignore, or skip logic
3. Never remove assertions — preserve test intent
4. Prefer stable selectors — data-testid > id > css class > xpath
5. Preserve existing patterns — if using Page Objects, fix the Page Object
6. Changes under 20 lines — if more needed, set needs_escalation: true

## Output Contract
Respond with valid JSON only:
{
  "file": "path/to/file.java",
  "changes": [
    {
      "old": "exact string to replace",
      "new": "replacement string"
    }
  ],
  "needs_escalation": false,
  "escalation_reason": null
}`,
          [{ mode: 'json', outputName: 'fix' }]
        ),
      },
      // === VALIDATION PLANNER ===
      {
        id: 'validation-planner',
        type: 'promptBlock',
        position: { x: 900, y: 350 },
        data: createPromptBlockData(
          'Validation Planner',
          `You are a Validation Planner for BDD Gherkin test fixes.

## Proposed Fix
{{fix}}

## Test File
{{test_file}}

## Task
Plan how to verify the fix works without causing regressions.

Validation tiers:
- Tier 1: Re-run the originally failing test (must pass)
- Tier 2: Run tests in the same file/class
- Tier 3: Run tests using the same page objects/selectors
- Tier 4: Module-level suite (time-boxed)

## Output Contract
Respond with valid JSON only:
{
  "commands": [
    { "type": "run_test", "test": "fully.qualified.TestName#methodName" }
  ],
  "scope": "SINGLE | CLASS | MODULE",
  "timeout_seconds": 300
}`,
          [{ mode: 'json', outputName: 'validation_plan' }]
        ),
      },
      // === VALIDATION ANALYZER ===
      {
        id: 'validation-analyzer',
        type: 'promptBlock',
        position: { x: 1200, y: 250 },
        data: createPromptBlockData(
          'Validation Analyzer',
          `You are a Validation Analyzer for BDD Gherkin test fixes.

## Proposed Fix
{{fix}}

## Test Execution Results
{{test_results}}

## Original Error
{{error_message}}

## Task
Determine if the fix worked:
1. Did the originally failing test now pass?
2. Did any other tests fail (regression)?
3. Should we approve, retry, or escalate?

## Output Contract
Respond with valid JSON only:
{
  "passed": true,
  "reasoning": "Explanation of the result",
  "regression_detected": false,
  "recommendation": "APPROVE | RETRY | ESCALATE"
}`,
          [{ mode: 'json', outputName: 'validation_result' }]
        ),
      },
      {
        id: 'output-1',
        type: 'output',
        position: { x: 1500, y: 250 },
        data: { label: 'Result', results: [], status: 'idle' },
      },
    ],
    edges: [
      // Start branches to Classifier and Inspection Planner (parallel)
      { id: 'e1', source: 'start-1', target: 'classifier', animated: true },
      { id: 'e2', source: 'start-1', target: 'inspection-planner', animated: true },
      // Both feed into Inspection Analyzer
      { id: 'e3', source: 'classifier', target: 'inspection-analyzer', animated: true },
      { id: 'e4', source: 'inspection-planner', target: 'inspection-analyzer', animated: true },
      // Inspection Analyzer feeds Fix Generator
      { id: 'e5', source: 'inspection-analyzer', target: 'fix-generator', animated: true },
      // Fix Generator feeds both Validation Planner
      { id: 'e6', source: 'fix-generator', target: 'validation-planner', animated: true },
      // Validation Planner feeds Validation Analyzer
      { id: 'e7', source: 'validation-planner', target: 'validation-analyzer', animated: true },
      // Also connect fix directly to validation analyzer for context
      { id: 'e8', source: 'fix-generator', target: 'validation-analyzer', animated: true },
      // Validation Analyzer to output
      { id: 'e9', source: 'validation-analyzer', target: 'output-1', animated: true },
    ],
  },
  {
    id: 'code-review',
    name: 'Code Review Pipeline',
    description: 'Multi-step code review with security, performance, and style checks',
    icon: '🔍',
    nodes: [
      {
        id: 'start-1',
        type: 'workflowStart',
        position: { x: 50, y: 200 },
        data: { label: 'Code Input' },
      },
      {
        id: 'security',
        type: 'promptBlock',
        position: { x: 300, y: 50 },
        data: createPromptBlockData(
          'Security Review',
          `You are a security code reviewer.

## Code to Review
{{input}}

## Task
Analyze for security vulnerabilities:
- SQL injection
- XSS vulnerabilities
- Authentication issues
- Data exposure

## Output
{
  "severity": "high | medium | low | none",
  "issues": [{"type": "...", "line": "...", "description": "..."}],
  "recommendations": ["..."]
}`,
          [{ mode: 'json', outputName: 'security_review' }]
        ),
      },
      {
        id: 'performance',
        type: 'promptBlock',
        position: { x: 300, y: 200 },
        data: createPromptBlockData(
          'Performance Review',
          `You are a performance code reviewer.

## Code to Review
{{input}}

## Task
Analyze for performance issues:
- N+1 queries
- Memory leaks
- Unnecessary re-renders
- Algorithm complexity

## Output
{
  "severity": "high | medium | low | none",
  "issues": [{"type": "...", "line": "...", "description": "..."}],
  "recommendations": ["..."]
}`,
          [{ mode: 'json', outputName: 'performance_review' }]
        ),
      },
      {
        id: 'style',
        type: 'promptBlock',
        position: { x: 300, y: 350 },
        data: createPromptBlockData(
          'Style Review',
          `You are a code style reviewer.

## Code to Review
{{input}}

## Task
Check code style and best practices:
- Naming conventions
- Code organization
- Documentation
- Error handling

## Output
{
  "severity": "high | medium | low | none",
  "issues": [{"type": "...", "line": "...", "description": "..."}],
  "recommendations": ["..."]
}`,
          [{ mode: 'json', outputName: 'style_review' }]
        ),
      },
      {
        id: 'aggregate',
        type: 'promptBlock',
        position: { x: 600, y: 200 },
        data: createPromptBlockData(
          'Aggregate Reviews',
          `You are a code review aggregator.

## Security Review
{{security_review}}

## Performance Review
{{performance_review}}

## Style Review
{{style_review}}

## Task
Combine all reviews into a final summary:
1. Prioritize issues by severity
2. Remove duplicates
3. Create actionable summary

## Output
{
  "overall_score": "A | B | C | D | F",
  "critical_issues": [...],
  "improvements": [...],
  "summary": "..."
}`,
          [{ mode: 'json', outputName: 'final_review' }]
        ),
      },
      {
        id: 'output-1',
        type: 'output',
        position: { x: 900, y: 200 },
        data: { label: 'Review Report', results: [], status: 'idle' },
      },
    ],
    edges: [
      { id: 'e1', source: 'start-1', target: 'security', animated: true },
      { id: 'e2', source: 'start-1', target: 'performance', animated: true },
      { id: 'e3', source: 'start-1', target: 'style', animated: true },
      { id: 'e4', source: 'security', target: 'aggregate', animated: true },
      { id: 'e5', source: 'performance', target: 'aggregate', animated: true },
      { id: 'e6', source: 'style', target: 'aggregate', animated: true },
      { id: 'e7', source: 'aggregate', target: 'output-1', animated: true },
    ],
  },
  {
    id: 'data-extraction',
    name: 'Data Extraction',
    description: 'Extract and transform data from unstructured text',
    icon: '📊',
    nodes: [
      {
        id: 'start-1',
        type: 'workflowStart',
        position: { x: 50, y: 200 },
        data: { label: 'Raw Data' },
      },
      {
        id: 'extract',
        type: 'promptBlock',
        position: { x: 300, y: 200 },
        data: createPromptBlockData(
          'Extract Entities',
          `You are a data extraction specialist.

## Input Text
{{input}}

## Task
Extract all relevant entities:
- Names (people, companies)
- Dates and times
- Numbers and amounts
- Locations
- Key terms

## Output
{
  "entities": {
    "names": [...],
    "dates": [...],
    "amounts": [...],
    "locations": [...],
    "keywords": [...]
  }
}`,
          [{ mode: 'json', outputName: 'entities' }]
        ),
      },
      {
        id: 'transform',
        type: 'promptBlock',
        position: { x: 600, y: 200 },
        data: createPromptBlockData(
          'Transform & Structure',
          `You are a data transformation specialist.

## Extracted Entities
{{entities}}

## Original Input
{{input}}

## Task
Transform the extracted data into a structured format:
1. Normalize dates to ISO format
2. Standardize amounts to numbers
3. Create relationships between entities

## Output
{
  "structured_data": {...},
  "relationships": [...],
  "metadata": {...}
}`,
          [{ mode: 'json', outputName: 'structured' }]
        ),
      },
      {
        id: 'output-1',
        type: 'output',
        position: { x: 900, y: 200 },
        data: { label: 'Structured Data', results: [], status: 'idle' },
      },
    ],
    edges: [
      { id: 'e1', source: 'start-1', target: 'extract', animated: true },
      { id: 'e2', source: 'extract', target: 'transform', animated: true },
      { id: 'e3', source: 'transform', target: 'output-1', animated: true },
    ],
  },
];

export function getPromptTemplateById(id: string): PromptWorkflowTemplate | undefined {
  return promptWorkflowTemplates.find((t) => t.id === id);
}
