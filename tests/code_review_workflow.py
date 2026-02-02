#!/usr/bin/env python3
"""
Code Review Workflow - Multi-agent code review pipeline.

This workflow uses multiple agents to:
1. Coder: Write/modify code
2. Reviewer: Review the code for issues
3. Tester: Suggest tests

Usage:
    python code_review_workflow.py "Implement a function to validate email addresses"
"""

import sys
from orchestrator import MultiAgentOrchestrator


def setup_team(orchestrator: MultiAgentOrchestrator):
    """Configure agents with roles and system prompts."""
    agents = orchestrator.get_running_agents()

    if len(agents) < 2:
        print("WARNING: For best results, open 2-3 IDE instances")

    team_config = [
        ("coder", ["kotlin", "java"], "You are a senior software developer. Write clean, efficient code. Only output code, no explanations unless asked."),
        ("reviewer", ["review", "analysis"], "You are a code reviewer. Analyze code for bugs, security issues, and improvements. Be concise and constructive."),
        ("tester", ["testing", "junit"], "You are a QA engineer. Write comprehensive unit tests. Only output test code, no explanations unless asked.")
    ]

    for i, agent in enumerate(agents[:3]):
        if i < len(team_config):
            role, capabilities, system_prompt = team_config[i]
            orchestrator.configure_agent(agent, role=role, capabilities=capabilities, system_prompt=system_prompt)
            print(f"  Configured {agent.agent_name} as '{role}'")

    orchestrator.discover_agents()
    return orchestrator


def code_review_pipeline(orchestrator: MultiAgentOrchestrator, task: str):
    """Run the code review pipeline."""

    print("\n" + "="*60)
    print("CODE REVIEW PIPELINE")
    print("="*60)

    # Step 1: Coder writes the code
    print("\n[1/3] CODER: Writing code...")
    coder = orchestrator.find_agent_by_role("coder")

    if not coder:
        # Fallback to first available agent
        coder = orchestrator.get_running_agents()[0]

    with coder.connect(timeout=120) as conn:
        code_result = conn.send_prompt(f"""
Write the code for the following task. Only output the code, no explanations.

Task: {task}
""")

    code = code_result.get("content", "No code generated")
    print(f"\nGenerated code:\n{'-'*40}\n{code[:500]}...\n{'-'*40}")

    # Step 2: Reviewer reviews the code
    print("\n[2/3] REVIEWER: Reviewing code...")
    reviewer = orchestrator.find_agent_by_role("reviewer")

    if reviewer:
        with reviewer.connect(timeout=120) as conn:
            review_result = conn.send_prompt(f"""
Review this code for bugs, security issues, and improvements. Be concise.

```
{code[:2000]}
```
""")
        review = review_result.get("content", "No review generated")
        print(f"\nReview:\n{'-'*40}\n{review[:500]}...\n{'-'*40}")
    else:
        print("  No reviewer agent - skipping")
        review = None

    # Step 3: Tester suggests tests
    print("\n[3/3] TESTER: Suggesting tests...")
    tester = orchestrator.find_agent_by_role("tester")

    if tester:
        with tester.connect(timeout=120) as conn:
            test_result = conn.send_prompt(f"""
Suggest unit tests for this code. Only output test code.

```
{code[:2000]}
```
""")
        tests = test_result.get("content", "No tests generated")
        print(f"\nSuggested tests:\n{'-'*40}\n{tests[:500]}...\n{'-'*40}")
    else:
        print("  No tester agent - skipping")
        tests = None

    # Summary
    print("\n" + "="*60)
    print("PIPELINE COMPLETE")
    print("="*60)
    print(f"  Code: {'Generated' if code else 'Failed'}")
    print(f"  Review: {'Generated' if review else 'Skipped'}")
    print(f"  Tests: {'Generated' if tests else 'Skipped'}")

    return {"code": code, "review": review, "tests": tests}


def main():
    import time

    if len(sys.argv) > 1:
        task = " ".join(sys.argv[1:])
    else:
        task = "Write a function that checks if a string is a palindrome"

    print(f"Task: {task}\n")

    # Initialize orchestrator
    orchestrator = MultiAgentOrchestrator()
    agents = orchestrator.get_running_agents()

    if not agents:
        print("ERROR: No running agents found!")
        print("Open IntelliJ IDE instances with the plugin installed.")
        return

    print(f"Found {len(agents)} agents")

    # Auto-spawn additional agents if needed (coder, reviewer, tester = 3)
    DESIRED_AGENT_COUNT = 3
    if len(agents) < DESIRED_AGENT_COUNT:
        print(f"\nSpawning {DESIRED_AGENT_COUNT - len(agents)} additional agents...")
        project_path = agents[0].project_path

        for i in range(DESIRED_AGENT_COUNT - len(agents)):
            print(f"  Spawning agent {i+1}...")
            result = orchestrator.spawn_agent(
                project_path=project_path,
                wait_for_ready=True,
                timeout=60
            )
            status = result.get("status", result.get("error", "unknown"))
            print(f"    Status: {status}")

            if i < DESIRED_AGENT_COUNT - len(agents) - 1:
                time.sleep(3)

        # Refresh agent list
        orchestrator.discover_agents()
        agents = orchestrator.get_running_agents()
        print(f"\nNow have {len(agents)} agents")

    # Setup team
    print("\nSetting up team...")
    setup_team(orchestrator)

    # Run pipeline
    results = code_review_pipeline(orchestrator, task)


if __name__ == "__main__":
    main()
