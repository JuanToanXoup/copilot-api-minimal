# Multi-Agent Workflow Dashboard

A visual workflow builder for orchestrating multiple AI agents. Design, configure, and execute complex multi-agent workflows through an intuitive drag-and-drop interface.

## Overview

The Dashboard module provides a React-based frontend for building and managing multi-agent workflows. It connects to AI agents running on different ports and allows you to:

- **Design workflows visually** using a node-based canvas
- **Configure agent roles** (Coder, Reviewer, Tester, Architect, Docs Writer, Debugger)
- **Define output schemas** to validate and structure agent responses
- **Execute workflows** with automatic agent orchestration
- **Monitor results** in real-time

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Dashboard Frontend                          │
│  ┌─────────────┐  ┌─────────────────────┐  ┌───────────────────┐   │
│  │   Sidebar   │  │   Workflow Canvas   │  │   Block Editor    │   │
│  │  - Agents   │  │   - Agent Nodes     │  │   - Name          │   │
│  │  - Templates│  │   - Connections     │  │   - Role          │   │
│  │  - Spawn    │  │   - Supervisor      │  │   - Output Schema │   │
│  └─────────────┘  └─────────────────────┘  └───────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                │ WebSocket
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Backend Server                              │
│                    (Agent Registry & Router)                        │
└─────────────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┼───────────────┐
                ▼               ▼               ▼
         ┌──────────┐    ┌──────────┐    ┌──────────┐
         │ Agent 1  │    │ Agent 2  │    │ Agent 3  │
         │ :60383   │    │ :60384   │    │ :60385   │
         │ (Coder)  │    │(Reviewer)│    │ (Tester) │
         └──────────┘    └──────────┘    └──────────┘
```

## Features

### Workflow Templates

Pre-built workflow patterns to get started quickly:

| Template | Description |
|----------|-------------|
| **Prompt Chaining** | Sequential agents where each refines the previous output |
| **Parallelization** | Fan-out to multiple agents, aggregate results |
| **Routing** | Classifier routes tasks to specialist agents |
| **Orchestrator-Worker** | Central orchestrator assigns tasks dynamically |
| **Evaluator-Optimizer** | Generator + Evaluator with rejection sampling |
| **Agent Loop** | Autonomous agent with tool feedback loop |

### Role-Based Agents

Each agent can be assigned a specialized role that determines its behavior:

| Role | Description |
|------|-------------|
| **Coder** | Software developer - writes clean, efficient code |
| **Reviewer** | Code reviewer - analyzes code for issues and improvements |
| **Tester** | QA engineer - writes tests and identifies edge cases |
| **Architect** | Software architect - designs systems and provides guidance |
| **Docs Writer** | Technical writer - creates documentation |
| **Debugger** | Debugging specialist - finds and fixes bugs |

Roles are fully customizable via the **Role Editor** - modify the system prompts to change agent behavior.

### Output Validation

Define JSON schemas to validate and structure agent outputs:

```json
{
  "type": "object",
  "properties": {
    "code": { "type": "string" },
    "language": { "type": "string" },
    "tests": { "type": "array" }
  },
  "required": ["code", "language"]
}
```

The workflow engine automatically retries agents that produce invalid outputs.

### Block Editor

Click any agent block to open the Block Editor panel:

- **Block Name** - Display name in the workflow
- **Role** - Select agent expertise
- **Output Type** - Text, Code, JSON, or Markdown
- **Output Schema** - JSON schema for validation

### Real-Time Monitoring

- Live connection status for all agents
- Step-by-step workflow execution visibility
- Error handling with user-friendly messages
- Toast notifications for important events

## Getting Started

### Prerequisites

- Node.js 18+
- Backend server running on port 8080
- One or more AI agents registered with the backend

### Installation

```bash
cd dashboard/frontend
npm install
```

### Development

```bash
npm run dev
```

Opens the dashboard at `http://localhost:5173` (or next available port).

### Production Build

```bash
npm run build
```

## Usage

### 1. Select a Workflow Template

Choose from the workflow patterns in the left sidebar, or start with an empty canvas.

### 2. Configure Agent Blocks

Click on any agent block to open the Block Editor:
- Set a descriptive name
- Choose the appropriate role
- Define output type and schema

### 3. Connect Agents

Drag from the sidebar to add available agents to the canvas. Connect them to workflow blocks.

### 4. Customize Roles (Optional)

Click **Edit Roles** in the toolbar to customize what each role does:
- Modify system prompts
- Change output instructions
- Preview the generated prompt

### 5. Run the Workflow

Enter your task in the Supervisor node and click **Start Workflow**. Watch as:
1. Supervisor analyzes the task
2. Each agent processes in sequence
3. Results flow through the pipeline
4. Final output appears in the Results node

### 6. Auto-Layout

Click **Auto Layout** to automatically arrange nodes in a clean hierarchical layout.

## Project Structure

```
dashboard/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AgentNode.tsx      # Agent block with config
│   │   │   ├── BlockEditor.tsx    # Side panel editor
│   │   │   ├── FlowManager.tsx    # Save/load workflows
│   │   │   ├── OutputNode.tsx     # Results display
│   │   │   ├── RoleEditor.tsx     # Role customization
│   │   │   ├── RouterNode.tsx     # Routing logic
│   │   │   ├── Sidebar.tsx        # Agent list & templates
│   │   │   ├── SupervisorNode.tsx # Workflow orchestrator
│   │   │   └── Toast.tsx          # Notifications
│   │   ├── utils/
│   │   │   ├── agentNaming.ts     # Agent name generation
│   │   │   ├── canvasLayout.ts    # Auto-arrange algorithm
│   │   │   ├── errorMessages.ts   # User-friendly errors
│   │   │   ├── outputValidator.ts # Schema validation
│   │   │   ├── promptBuilder.ts   # Prompt generation
│   │   │   └── roleConfig.ts      # Role definitions
│   │   ├── App.tsx                # Main application
│   │   ├── store.ts               # Zustand state management
│   │   ├── types.ts               # TypeScript interfaces
│   │   └── workflowTemplates.ts   # Pre-built templates
│   └── package.json
├── backend/                       # WebSocket server
├── build.gradle.kts
└── run.sh
```

## Key Concepts

### Multi-Agent Orchestration

The dashboard enables several orchestration patterns:

1. **Sequential Processing**: Chain agents where each builds on the previous output
2. **Parallel Processing**: Fan out to multiple agents simultaneously
3. **Conditional Routing**: Route tasks based on content or classification
4. **Iterative Refinement**: Loop through review cycles until quality threshold met

### Prompt Engineering

Each agent receives a structured prompt:

```
[Role: CODER]
You are a software developer. Write clean, efficient code.

[Expected Output: CODE]
Respond with code in a code block.

[Output Schema]
Your response must conform to this schema:
{"language": "typescript"}

---
{user input}
```

### State Management

The dashboard uses Zustand for state management:
- **Agents**: Connected agents from the backend
- **Role Definitions**: Customizable role configurations
- **Toasts**: Notification queue
- **Activity**: Event log for debugging

## API Integration

The frontend connects to the backend via WebSocket:

```typescript
// Connect
ws://localhost:8080/ws

// Message Types
{ type: 'initial', agents: [...] }           // Initial state
{ type: 'agents_update', agents: [...] }     // Agent changes
{ type: 'send_prompt', instance_id, prompt } // Send to agent
{ type: 'prompt_result', instance_id, result } // Agent response
{ type: 'spawn_agent', project_path, role }  // Launch new agent
```

## Troubleshooting

### "Agent is busy processing another request"
The agent is handling another task. Wait for completion or use a different agent.

### "Connection Failed"
Check that:
1. Backend server is running on port 8080
2. Agent is running and registered
3. No firewall blocking WebSocket connections

### Workflow not executing
Ensure:
1. At least one agent is connected (green status)
2. Agents are assigned to workflow blocks
3. Supervisor node has a task entered

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `npm run build` to verify
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
