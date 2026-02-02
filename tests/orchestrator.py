#!/usr/bin/env python3
"""
Multi-Agent Orchestrator for Copilot API.

Coordinates multiple IDE instances, each acting as a specialized agent.
"""

import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from typing import Any, Callable, Optional

try:
    import websocket
except ImportError:
    print("Error: websocket-client required. Install with: pip install websocket-client")
    sys.exit(1)


@dataclass
class Agent:
    """Represents a connected agent."""
    instance_id: str
    project_path: str
    port: int
    agent_name: str
    role: Optional[str]
    capabilities: Optional[list]

    def connect(self, timeout: int = 30) -> 'AgentConnection':
        """Create a connection to this agent."""
        return AgentConnection(self, timeout)


class AgentConnection:
    """Active connection to an agent."""

    def __init__(self, agent: Agent, timeout: int = 30):
        self.agent = agent
        self.timeout = timeout
        self.ws = None
        self.config = None

    def connect(self) -> 'AgentConnection':
        url = f"ws://localhost:{self.agent.port}"
        self.ws = websocket.create_connection(url, timeout=self.timeout)
        # Receive initial config
        initial = self.ws.recv()
        self.config = json.loads(initial)
        return self

    def disconnect(self):
        if self.ws:
            self.ws.close()

    def send(self, message: dict) -> dict:
        """Send a message and receive response."""
        self.ws.send(json.dumps(message))
        response = self.ws.recv()
        return json.loads(response)

    def send_prompt(self, prompt: str, wait_for_result: bool = True) -> dict:
        """Send a Copilot prompt."""
        self.ws.send(json.dumps({"type": "copilotPrompt", "prompt": prompt}))
        response = json.loads(self.ws.recv())

        if wait_for_result and response.get("status") == "executing":
            response = json.loads(self.ws.recv())

        return response

    def set_role(self, role: str) -> dict:
        return self.send({"type": "setAgentRole", "role": role})

    def set_capabilities(self, capabilities: list) -> dict:
        return self.send({"type": "setAgentCapabilities", "capabilities": capabilities})

    def set_system_prompt(self, prompt: str) -> dict:
        return self.send({"type": "setAgentSystemPrompt", "systemPrompt": prompt})

    def delegate_to(self, target_port: int, prompt: str) -> dict:
        """Delegate a task to another agent."""
        return self.send({
            "type": "delegateToAgent",
            "targetPort": target_port,
            "prompt": prompt
        })

    def delegate_to_role(self, role: str, prompt: str) -> dict:
        """Delegate a task to an agent with the specified role."""
        return self.send({
            "type": "delegateToAgent",
            "targetRole": role,
            "prompt": prompt
        })

    def spawn_agent(self, project_path: str, role: str = None,
                    capabilities: list = None, wait_for_ready: bool = True) -> dict:
        """Spawn a new agent for a project."""
        return self.send({
            "type": "spawnAgent",
            "projectPath": project_path,
            "role": role,
            "capabilities": capabilities,
            "waitForReady": wait_for_ready
        })

    def list_projects(self) -> dict:
        """List all projects and their instances."""
        return self.send({"type": "listProjects"})

    def __enter__(self):
        return self.connect()

    def __exit__(self, *args):
        self.disconnect()


@dataclass
class Task:
    """A task to be executed by an agent."""
    prompt: str
    required_role: Optional[str] = None
    required_capabilities: Optional[list] = None
    priority: int = 0
    metadata: Optional[dict] = None


class MultiAgentOrchestrator:
    """Orchestrates multiple agents for complex workflows."""

    def __init__(self, registry_path: Optional[str] = None):
        self.registry_path = registry_path or os.path.join(
            os.path.expanduser("~"), ".citi-agent", "registry.json"
        )
        self.agents: dict[str, Agent] = {}
        self.discover_agents()

    def discover_agents(self) -> dict[str, Agent]:
        """Load all agents from the registry."""
        if not os.path.exists(self.registry_path):
            print(f"Registry not found: {self.registry_path}")
            return {}

        try:
            with open(self.registry_path, "r") as f:
                registry = json.load(f)

            self.agents = {}
            for instance_id, entry in registry.items():
                self.agents[instance_id] = Agent(
                    instance_id=instance_id,
                    project_path=entry.get("projectPath", ""),
                    port=entry.get("port", 0),
                    agent_name=entry.get("agentName", "Unknown"),
                    role=entry.get("role"),
                    capabilities=entry.get("capabilities")
                )

            print(f"Discovered {len(self.agents)} agents")
            return self.agents
        except Exception as e:
            print(f"Error reading registry: {e}")
            return {}

    def get_agents(self) -> list[Agent]:
        """Get all discovered agents."""
        return list(self.agents.values())

    def get_running_agents(self) -> list[Agent]:
        """Get only agents that are currently responding."""
        running = []
        for agent in self.agents.values():
            try:
                import socket
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(1)
                result = sock.connect_ex(('localhost', agent.port))
                sock.close()
                if result == 0:
                    running.append(agent)
            except:
                pass
        return running

    def find_agent_by_role(self, role: str) -> Optional[Agent]:
        """Find the first agent with the specified role."""
        for agent in self.agents.values():
            if agent.role and agent.role.lower() == role.lower():
                return agent
        return None

    def find_agents_by_role(self, role: str) -> list[Agent]:
        """Find all agents with the specified role."""
        return [
            agent for agent in self.agents.values()
            if agent.role and agent.role.lower() == role.lower()
        ]

    def find_agent_by_capability(self, capability: str) -> Optional[Agent]:
        """Find the first agent with the specified capability."""
        for agent in self.agents.values():
            if agent.capabilities:
                if any(cap.lower() == capability.lower() for cap in agent.capabilities):
                    return agent
        return None

    def find_agents_by_capability(self, capability: str) -> list[Agent]:
        """Find all agents with the specified capability."""
        return [
            agent for agent in self.agents.values()
            if agent.capabilities and any(
                cap.lower() == capability.lower() for cap in agent.capabilities
            )
        ]

    def find_best_agent_for_task(self, task: Task) -> Optional[Agent]:
        """Find the best agent for a task based on role/capabilities."""
        candidates = list(self.agents.values())

        # Filter by role if specified
        if task.required_role:
            candidates = [a for a in candidates if a.role and a.role.lower() == task.required_role.lower()]

        # Filter by capabilities if specified
        if task.required_capabilities:
            def has_capabilities(agent):
                if not agent.capabilities:
                    return False
                agent_caps = [c.lower() for c in agent.capabilities]
                return all(cap.lower() in agent_caps for cap in task.required_capabilities)
            candidates = [a for a in candidates if has_capabilities(a)]

        # Return first matching agent (could add more sophisticated selection)
        return candidates[0] if candidates else None

    def route_task(self, task: Task, timeout: int = 60) -> dict:
        """Route a task to the best available agent."""
        agent = self.find_best_agent_for_task(task)
        if not agent:
            return {"error": "No suitable agent found", "task": task.prompt}

        try:
            with agent.connect(timeout=timeout) as conn:
                result = conn.send_prompt(task.prompt)
                return {
                    "agent": agent.agent_name,
                    "role": agent.role,
                    "port": agent.port,
                    "result": result
                }
        except Exception as e:
            return {"error": str(e), "agent": agent.agent_name}

    def execute_on_agent(self, agent: Agent, prompt: str, timeout: int = 60) -> dict:
        """Execute a prompt on a specific agent."""
        try:
            with agent.connect(timeout=timeout) as conn:
                result = conn.send_prompt(prompt)
                return {
                    "agent": agent.agent_name,
                    "role": agent.role,
                    "port": agent.port,
                    "result": result
                }
        except Exception as e:
            return {"error": str(e), "agent": agent.agent_name}

    def parallel_execute(self, tasks: list[Task], max_workers: int = 4, timeout: int = 60) -> list[dict]:
        """Execute multiple tasks in parallel across agents."""
        results = []

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {
                executor.submit(self.route_task, task, timeout): task
                for task in tasks
            }

            for future in as_completed(futures):
                task = futures[future]
                try:
                    result = future.result()
                    results.append(result)
                except Exception as e:
                    results.append({"error": str(e), "task": task.prompt})

        return results

    def broadcast(self, message: dict, roles: Optional[list] = None) -> list[dict]:
        """Broadcast a message to all agents (optionally filtered by roles)."""
        results = []
        agents = self.get_running_agents()

        if roles:
            agents = [a for a in agents if a.role and a.role.lower() in [r.lower() for r in roles]]

        for agent in agents:
            try:
                with agent.connect(timeout=10) as conn:
                    result = conn.send(message)
                    results.append({
                        "agent": agent.agent_name,
                        "port": agent.port,
                        "result": result
                    })
            except Exception as e:
                results.append({
                    "agent": agent.agent_name,
                    "port": agent.port,
                    "error": str(e)
                })

        return results

    def configure_agent(self, agent: Agent, role: str = None,
                        capabilities: list = None, system_prompt: str = None) -> dict:
        """Configure an agent's role, capabilities, and system prompt."""
        try:
            with agent.connect(timeout=10) as conn:
                config = {}
                if role:
                    conn.set_role(role)
                    config["role"] = role
                if capabilities:
                    conn.set_capabilities(capabilities)
                    config["capabilities"] = capabilities
                if system_prompt:
                    conn.set_system_prompt(system_prompt)
                    config["systemPrompt"] = system_prompt[:50] + "..."

                return {"agent": agent.agent_name, "config": config}
        except Exception as e:
            return {"agent": agent.agent_name, "error": str(e)}

    def setup_team(self, team_config: dict[str, dict]) -> list[dict]:
        """
        Set up a team of agents with specific roles.

        Example:
            orchestrator.setup_team({
                "coder": {"capabilities": ["kotlin", "java"], "system_prompt": "You write code"},
                "tester": {"capabilities": ["testing", "junit"], "system_prompt": "You write tests"},
                "reviewer": {"capabilities": ["review"], "system_prompt": "You review code"}
            })
        """
        results = []
        agents = self.get_running_agents()

        for i, (role, config) in enumerate(team_config.items()):
            if i >= len(agents):
                results.append({"error": f"Not enough agents for role: {role}"})
                continue

            agent = agents[i]
            result = self.configure_agent(
                agent,
                role=role,
                capabilities=config.get("capabilities"),
                system_prompt=config.get("system_prompt")
            )
            results.append(result)

        # Refresh agent list
        self.discover_agents()
        return results

    def spawn_agent(self, project_path: str, role: str = None,
                    capabilities: list = None, via_agent: Agent = None,
                    wait_for_ready: bool = True, timeout: int = 30) -> dict:
        """
        Spawn a new IDE instance for a project.

        Args:
            project_path: Path to the project
            role: Role to assign to the new agent
            capabilities: Capabilities to assign
            via_agent: Existing agent to use for spawning (if None, uses first available)
            wait_for_ready: Wait for the new agent to be ready
            timeout: Timeout in seconds when waiting
        """
        if via_agent is None:
            running = self.get_running_agents()
            if not running:
                return {"error": "No running agents to spawn from"}
            via_agent = running[0]

        try:
            with via_agent.connect(timeout=timeout + 10) as conn:
                result = conn.send({
                    "type": "spawnAgent",
                    "projectPath": project_path,
                    "role": role,
                    "capabilities": capabilities,
                    "waitForReady": wait_for_ready,
                    "timeout": timeout
                })

                # Refresh agents list
                if result.get("status") == "success":
                    self.discover_agents()

                return result
        except Exception as e:
            return {"error": str(e)}

    def spawn_team(self, project_path: str, roles: list[str],
                   capabilities_map: dict[str, list] = None) -> list[dict]:
        """
        Spawn multiple agents for the same project with different roles.

        Example:
            orchestrator.spawn_team("/path/to/project", ["coder", "tester", "reviewer"])
        """
        results = []
        capabilities_map = capabilities_map or {}

        for role in roles:
            result = self.spawn_agent(
                project_path=project_path,
                role=role,
                capabilities=capabilities_map.get(role),
                wait_for_ready=True
            )
            results.append(result)

            # Wait a bit between spawns
            import time
            time.sleep(2)

        return results

    def ensure_agent_for_role(self, role: str, project_path: str = None) -> Optional[Agent]:
        """
        Ensure an agent exists for the given role, spawning one if needed.
        """
        agent = self.find_agent_by_role(role)
        if agent:
            return agent

        # Need to spawn a new agent
        if project_path is None:
            # Use the first known project
            if not self.agents:
                return None
            project_path = list(self.agents.values())[0].project_path

        result = self.spawn_agent(project_path, role=role, wait_for_ready=True)
        if result.get("status") == "success" and result.get("newAgentPort"):
            self.discover_agents()
            return self.find_agent_by_role(role)

        return None


# ==================== Workflow Templates ====================

class CodeReviewWorkflow:
    """A workflow for code review using multiple agents."""

    def __init__(self, orchestrator: MultiAgentOrchestrator):
        self.orchestrator = orchestrator

    def review(self, code: str) -> dict:
        """Run a multi-agent code review."""
        results = {}

        # Find specialized agents
        coder = self.orchestrator.find_agent_by_role("coder")
        reviewer = self.orchestrator.find_agent_by_role("reviewer")
        tester = self.orchestrator.find_agent_by_role("tester")

        # Get code review from reviewer
        if reviewer:
            with reviewer.connect() as conn:
                results["review"] = conn.send_prompt(
                    f"Review this code for issues, improvements, and best practices:\n\n{code}"
                )

        # Get test suggestions from tester
        if tester:
            with tester.connect() as conn:
                results["tests"] = conn.send_prompt(
                    f"Suggest unit tests for this code:\n\n{code}"
                )

        return results


class ParallelCodingWorkflow:
    """A workflow for parallel coding tasks."""

    def __init__(self, orchestrator: MultiAgentOrchestrator):
        self.orchestrator = orchestrator

    def implement_features(self, features: list[str]) -> list[dict]:
        """Implement multiple features in parallel."""
        tasks = [
            Task(
                prompt=f"Implement the following feature:\n\n{feature}",
                required_role="coder"
            )
            for feature in features
        ]
        return self.orchestrator.parallel_execute(tasks)


# ==================== CLI Interface ====================

def main():
    import argparse

    parser = argparse.ArgumentParser(description="Multi-Agent Orchestrator")
    parser.add_argument("--discover", action="store_true", help="Discover and list all agents")
    parser.add_argument("--running", action="store_true", help="Show only running agents")
    parser.add_argument("--configure", nargs=3, metavar=("PORT", "ROLE", "CAPABILITIES"),
                        help="Configure an agent: PORT ROLE 'cap1,cap2'")
    parser.add_argument("--prompt", nargs=2, metavar=("PORT", "PROMPT"),
                        help="Send a prompt to a specific agent")
    parser.add_argument("--broadcast", metavar="MESSAGE", help="Broadcast a message to all agents")
    parser.add_argument("--role", help="Filter by role (for --broadcast, --delegate)")
    parser.add_argument("--spawn", metavar="PROJECT_PATH", help="Spawn a new agent for a project")
    parser.add_argument("--spawn-role", help="Role for spawned agent")
    parser.add_argument("--spawn-caps", help="Capabilities for spawned agent (comma-separated)")
    parser.add_argument("--delegate", nargs=2, metavar=("ROLE", "PROMPT"),
                        help="Delegate a prompt to an agent by role")
    parser.add_argument("--projects", action="store_true", help="List all projects and instances")
    args = parser.parse_args()

    orchestrator = MultiAgentOrchestrator()

    if args.projects:
        running = orchestrator.get_running_agents()
        if running:
            with running[0].connect() as conn:
                result = conn.list_projects()
                projects = result.get("projects", [])
                print(f"\n{'='*60}")
                print(f"PROJECTS ({len(projects)})")
                print(f"{'='*60}")
                for proj in projects:
                    print(f"\n  {proj['projectName']}")
                    print(f"  Path: {proj['projectPath']}")
                    print(f"  Instances: {proj['instanceCount']}")
                    for inst in proj.get('instances', []):
                        status = "RUNNING" if inst['isRunning'] else "STOPPED"
                        role = inst.get('role') or 'unassigned'
                        print(f"    - Port {inst['port']}: {role} [{status}]")

    elif args.spawn:
        caps = args.spawn_caps.split(",") if args.spawn_caps else None
        result = orchestrator.spawn_agent(
            args.spawn,
            role=args.spawn_role,
            capabilities=caps,
            wait_for_ready=True
        )
        print(f"Spawn result: {json.dumps(result, indent=2)}")

    elif args.delegate:
        role, prompt = args.delegate
        agent = orchestrator.find_agent_by_role(role)
        if agent:
            result = orchestrator.execute_on_agent(agent, prompt)
            print(f"Result from {role}: {json.dumps(result, indent=2)}")
        else:
            print(f"No agent found with role: {role}")

    elif args.discover or (not any([args.configure, args.prompt, args.broadcast])):
        agents = orchestrator.get_running_agents() if args.running else orchestrator.get_agents()
        print(f"\n{'='*60}")
        print(f"{'RUNNING ' if args.running else ''}AGENTS ({len(agents)})")
        print(f"{'='*60}")
        for agent in agents:
            caps = ", ".join(agent.capabilities) if agent.capabilities else "none"
            print(f"  Port: {agent.port}")
            print(f"  Name: {agent.agent_name}")
            print(f"  Role: {agent.role or 'unassigned'}")
            print(f"  Capabilities: {caps}")
            print(f"  Project: {os.path.basename(agent.project_path)}")
            print(f"  ---")

    if args.configure:
        port, role, caps = args.configure
        agent = next((a for a in orchestrator.get_agents() if a.port == int(port)), None)
        if agent:
            result = orchestrator.configure_agent(
                agent,
                role=role,
                capabilities=caps.split(",")
            )
            print(f"Configured: {result}")
        else:
            print(f"Agent not found on port {port}")

    if args.prompt:
        port, prompt = args.prompt
        agent = next((a for a in orchestrator.get_agents() if a.port == int(port)), None)
        if agent:
            result = orchestrator.execute_on_agent(agent, prompt)
            print(f"Result: {json.dumps(result, indent=2)}")
        else:
            print(f"Agent not found on port {port}")

    if args.broadcast:
        roles = [args.role] if args.role else None
        results = orchestrator.broadcast({"type": args.broadcast}, roles=roles)
        for r in results:
            print(f"{r['agent']}: {r.get('result', r.get('error', 'unknown'))}")


if __name__ == "__main__":
    main()
