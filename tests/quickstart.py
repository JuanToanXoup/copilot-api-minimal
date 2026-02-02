#!/usr/bin/env python3
"""
Quickstart - Minimal example of multi-agent orchestration.

Run: python quickstart.py
"""

from orchestrator import MultiAgentOrchestrator

# Auto-discover all agents
orchestrator = MultiAgentOrchestrator()

# Get running agents
agents = orchestrator.get_running_agents()
print(f"Found {len(agents)} running agents\n")

if not agents:
    print("No agents running. Open an IntelliJ project with the plugin.")
    exit(1)

# Show discovered agents
for agent in agents:
    print(f"  [{agent.port}] {agent.role or 'no role'} - {agent.agent_name}")

# Connect to first agent and send a prompt
print("\nSending prompt to first agent...")
agent = agents[0]

with agent.connect() as conn:
    response = conn.send_prompt("Say hello in one sentence.")
    print(f"\nResponse: {response.get('content', response)}")
