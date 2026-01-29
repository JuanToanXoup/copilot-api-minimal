#!/usr/bin/env python3
"""Run all individual tests."""

import subprocess
import sys
import os

TESTS = [
    ("test_ping.py", "Ping/Pong"),
    ("test_get_current_prompt.py", "Get Current Prompt"),
    ("test_get_pending_prompts.py", "Get Pending Prompts"),
    ("test_set_ask_mode.py", "Set Ask Mode"),
    ("test_set_agent_mode.py", "Set Agent Mode"),
    ("test_set_model_gpt.py", "Set Model GPT-4o"),
    ("test_set_model_gpt41.py", "Set Model GPT-4.1"),
    ("test_set_model_claude.py", "Set Model Claude Sonnet 4"),
    ("test_set_model_gemini.py", "Set Model Gemini 2.5 Pro"),
    ("test_new_session.py", "New Session"),
    ("test_cli_command.py", "CLI Command"),
    ("test_diagnose_ui.py", "Diagnose UI"),
    ("test_inspect_input.py", "Inspect Input"),
]

SLOW_TESTS = [
    ("test_copilot_prompt.py", "Copilot Prompt"),
]

DESTRUCTIVE_TESTS = [
    ("test_shutdown.py", "Shutdown"),
]


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Run all Copilot API tests")
    parser.add_argument("--port", type=int, default=8765, help="WebSocket port")
    parser.add_argument("--host", default="localhost", help="WebSocket host")
    parser.add_argument("--skip-slow", action="store_true", help="Skip slow Copilot prompt tests")
    parser.add_argument("--skip-shutdown", action="store_true", help="Skip shutdown test")
    parser.add_argument("--only", help="Run only this test (e.g., test_ping.py)")
    args = parser.parse_args()

    script_dir = os.path.dirname(os.path.abspath(__file__))
    results = []

    tests_to_run = TESTS.copy()
    if not args.skip_slow:
        tests_to_run.extend(SLOW_TESTS)
    if not args.skip_shutdown:
        tests_to_run.extend(DESTRUCTIVE_TESTS)

    if args.only:
        tests_to_run = [(t, n) for t, n in tests_to_run if t == args.only or n.lower() == args.only.lower()]
        if not tests_to_run:
            print(f"Test not found: {args.only}")
            return 1

    print(f"\n{'='*60}")
    print("COPILOT API - INDIVIDUAL TESTS")
    print(f"{'='*60}")
    print(f"Host: {args.host}:{args.port}")
    print(f"Tests to run: {len(tests_to_run)}")
    print(f"{'='*60}\n")

    for test_file, test_name in tests_to_run:
        test_path = os.path.join(script_dir, test_file)
        print(f"\n--- Running: {test_name} ---")

        result = subprocess.run(
            [sys.executable, test_path, "--host", args.host, "--port", str(args.port)],
            capture_output=False
        )

        passed = result.returncode == 0
        results.append((test_name, passed))

    # Summary
    print(f"\n{'='*60}")
    print("SUMMARY")
    print(f"{'='*60}")

    passed = sum(1 for _, p in results if p)
    failed = sum(1 for _, p in results if not p)

    for name, p in results:
        status = "PASSED" if p else "FAILED"
        print(f"  {status}: {name}")

    print(f"\nTotal: {passed} passed, {failed} failed")
    print(f"{'='*60}")

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    exit(main())
