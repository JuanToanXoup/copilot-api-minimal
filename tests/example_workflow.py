#!/usr/bin/env python3
"""
Example Multi-Agent Workflow

This script demonstrates how to use the orchestrator to coordinate
multiple IDE instances as specialized agents.

Prerequisites:
1. Have 2+ IntelliJ instances open with the plugin installed
2. Run: pip install websocket-client

Usage:
    python example_workflow.py
"""

import json
import time
from orchestrator import MultiAgentOrchestrator, Task, AgentConnection


def print_header(text):
    print(f"\n{'='*60}")
    print(f"  {text}")
    print(f"{'='*60}\n")


def main():
    # =========================================================
    # Step 1: Auto-discover agents
    # =========================================================
    print_header("Step 1: Auto-Discovery")

    orchestrator = MultiAgentOrchestrator()

    all_agents = orchestrator.get_agents()
    running_agents = orchestrator.get_running_agents()

    print(f"Registry has {len(all_agents)} agents")
    print(f"Currently running: {len(running_agents)} agents\n")

    if not running_agents:
        print("ERROR: No running agents found!")
        print("Please open at least one IntelliJ project with the plugin installed.")
        return

    for agent in running_agents:
        caps = ", ".join(agent.capabilities) if agent.capabilities else "none"
        print(f"  Agent: {agent.agent_name}")
        print(f"    Port: {agent.port}")
        print(f"    Role: {agent.role or 'unassigned'}")
        print(f"    Capabilities: {caps}")
        print(f"    Project: {agent.project_path}")
        print()

    # =========================================================
    # Step 1b: Auto-spawn additional agents if needed
    # =========================================================
    DESIRED_AGENT_COUNT = 3  # coder, reviewer, tester

    if len(running_agents) < DESIRED_AGENT_COUNT:
        print_header("Step 1b: Auto-Spawn Agents")

        project_path = running_agents[0].project_path
        agents_to_spawn = DESIRED_AGENT_COUNT - len(running_agents)

        print(f"Need {agents_to_spawn} more agents. Spawning...")

        for i in range(agents_to_spawn):
            print(f"\n  Spawning agent {i+1}/{agents_to_spawn}...")
            result = orchestrator.spawn_agent(
                project_path=project_path,
                wait_for_ready=True,
                timeout=60
            )
            status = result.get("status", result.get("error", "unknown"))
            new_port = result.get("newAgentPort", "pending")
            print(f"    Status: {status}, Port: {new_port}")

            # Wait a bit between spawns
            if i < agents_to_spawn - 1:
                print("    Waiting for IDE to stabilize...")
                time.sleep(3)

        # Refresh agent list
        orchestrator.discover_agents()
        running_agents = orchestrator.get_running_agents()
        print(f"\nNow have {len(running_agents)} running agents")

    # =========================================================
    # Step 2: Configure agents with roles (if not already set)
    # =========================================================
    print_header("Step 2: Configure Roles")

    # Define the team structure with system prompts that define behavior
    team_config = {
        "coder": {
            "capabilities": ["kotlin", "java"],
            "system_prompt": "You are a senior software developer. Write clean, efficient, well-documented code. Focus on implementation."
        },
        "reviewer": {
            "capabilities": ["review", "analysis"],
            "system_prompt": "You are a code reviewer. Analyze code for bugs, security issues, and improvements. Be concise and constructive."
        },
        "tester": {
            "capabilities": ["testing", "junit"],
            "system_prompt": "You are a QA engineer. Write comprehensive unit tests and identify edge cases. Focus on test coverage."
        }
    }

    roles = list(team_config.keys())

    for i, agent in enumerate(running_agents):
        if i >= len(roles):
            break

        role = roles[i]
        config = team_config[role]
        print(f"Configuring {agent.agent_name} as '{role}'...")

        result = orchestrator.configure_agent(
            agent,
            role=role,
            capabilities=config["capabilities"],
            system_prompt=config["system_prompt"]
        )
        print(f"  Result: {result}\n")

    # Refresh to get updated roles
    orchestrator.discover_agents()

    # =========================================================
    # Step 3: Simple prompt to a specific agent
    # =========================================================
    print_header("Step 3: Direct Prompt")

    first_agent = running_agents[0]
    print(f"Sending prompt to {first_agent.agent_name} (port {first_agent.port})...")

    with first_agent.connect(timeout=60) as conn:
        # Get agent config
        config = conn.send({"type": "getAgentConfig"})
        print(f"  Agent config: role={config.get('role')}, caps={config.get('capabilities')}")

        # Send a simple prompt
        result = conn.send_prompt("What is 2 + 2? Reply with just the number.")
        print(f"  Response status: {result.get('status')}")
        if result.get('content'):
            print(f"  Result: {result.get('content')[:200]}...")

    # =========================================================
    # Step 4: Route task by role
    # =========================================================
    print_header("Step 4: Route by Role")

    coder = orchestrator.find_agent_by_role("coder")
    if coder:
        print(f"Found coder: {coder.agent_name} @ port {coder.port}")

        task = Task(
            prompt="Write a simple Kotlin function that adds two numbers",
            required_role="coder"
        )

        print("Routing task to coder...")
        result = orchestrator.route_task(task, timeout=90)
        print(f"  Status: {result.get('result', {}).get('status', 'unknown')}")
    else:
        print("No agent with role 'coder' found")

    # =========================================================
    # Step 5: Discover agents via WebSocket
    # =========================================================
    print_header("Step 5: Discover via WebSocket")

    with running_agents[0].connect() as conn:
        # Discover all agents through the WebSocket API
        discovery = conn.send({"type": "discoverAgents"})
        agents_list = discovery.get("agents", [])

        print(f"Discovered {len(agents_list)} agents via WebSocket:")
        for a in agents_list:
            current = " (current)" if a.get("isCurrentInstance") else ""
            print(f"  - Port {a['port']}: {a.get('role', 'unassigned')}{current}")

    # =========================================================
    # Step 6: Agent-to-Agent Delegation (if 2+ agents)
    # =========================================================
    if len(running_agents) >= 2:
        print_header("Step 6: Agent-to-Agent Delegation")

        source = running_agents[0]
        target = running_agents[1]

        print(f"Delegating from {source.agent_name} to {target.agent_name}...")

        with source.connect(timeout=120) as conn:
            result = conn.delegate_to(
                target.port,
                "What programming language are you helping with? Reply briefly."
            )
            print(f"  Delegation result: {json.dumps(result, indent=2)[:500]}")
    else:
        print_header("Step 6: Agent-to-Agent Delegation")
        print("Skipped - need 2+ running agents for delegation demo")

    # =========================================================
    # Step 7: Parallel Execution (if 2+ agents)
    # =========================================================
    if len(running_agents) >= 2:
        print_header("Step 7: Parallel Execution")

        tasks = [
            Task(prompt="What is the capital of France? Reply with just the city name."),
            Task(prompt="What is the capital of Japan? Reply with just the city name."),
        ]

        print(f"Executing {len(tasks)} tasks in parallel...")
        start = time.time()

        results = orchestrator.parallel_execute(tasks[:len(running_agents)], timeout=60)

        elapsed = time.time() - start
        print(f"Completed in {elapsed:.1f}s\n")

        for i, result in enumerate(results):
            agent = result.get('agent', 'unknown')
            status = result.get('result', {}).get('status', result.get('error', 'unknown'))
            print(f"  Task {i+1} ({agent}): {status}")
    else:
        print_header("Step 7: Parallel Execution")
        print("Skipped - need 2+ running agents for parallel demo")

    # =========================================================
    # Summary
    # =========================================================
    print_header("Summary")

    print("Multi-agent capabilities demonstrated:")
    print("  ✓ Auto-discovery from registry")
    print("  ✓ Role configuration")
    print("  ✓ Direct prompts")
    print("  ✓ Role-based routing")
    print("  ✓ WebSocket-based discovery")
    if len(running_agents) >= 2:
        print("  ✓ Agent-to-agent delegation")
        print("  ✓ Parallel execution")

    print("\nNext steps:")
    print("  1. Open more IDE instances to add agents")
    print("  2. Use --spawn to create new agents programmatically")
    print("  3. Build custom workflows for your use case")


if __name__ == "__main__":
    main()
