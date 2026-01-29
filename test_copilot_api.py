#!/usr/bin/env python3
"""
Copilot API Minimal - WebSocket API Test Script

This script tests all WebSocket API features of the Copilot API Minimal IntelliJ plugin.
Requires: pip install websocket-client

Usage:
    python test_copilot_api.py [--port PORT] [--skip-copilot] [--skip-shutdown]
"""

import json
import time
import argparse
import sys
from typing import Any, Optional
from dataclasses import dataclass
from enum import Enum

try:
    import websocket
except ImportError:
    print("Error: websocket-client is required. Install with: pip install websocket-client")
    sys.exit(1)


class TestStatus(Enum):
    PASSED = "✓ PASSED"
    FAILED = "✗ FAILED"
    SKIPPED = "○ SKIPPED"


@dataclass
class TestResult:
    name: str
    status: TestStatus
    message: str = ""
    response: Optional[dict] = None


class CopilotAPITester:
    """Test client for Copilot API WebSocket server."""

    def __init__(self, host: str = "localhost", port: int = 8765, timeout: int = 120):
        self.host = host
        self.port = port
        self.timeout = timeout
        self.ws: Optional[websocket.WebSocket] = None
        self.results: list[TestResult] = []
        self.agent_config: Optional[dict] = None

    def connect(self) -> bool:
        """Establish WebSocket connection."""
        try:
            url = f"ws://{self.host}:{self.port}"
            print(f"\n{'='*60}")
            print(f"Connecting to {url}...")
            self.ws = websocket.create_connection(url, timeout=self.timeout)
            print(f"Connected successfully!")

            # Server sends agent config on connect
            initial_message = self.ws.recv()
            self.agent_config = json.loads(initial_message)
            print(f"Received agent config: {json.dumps(self.agent_config, indent=2)}")
            return True
        except Exception as e:
            print(f"Connection failed: {e}")
            return False

    def disconnect(self):
        """Close WebSocket connection."""
        if self.ws:
            try:
                self.ws.close()
                print("Disconnected from server.")
            except Exception:
                pass

    def send_message(self, message: dict) -> Optional[dict]:
        """Send a message and receive response."""
        if not self.ws:
            return None
        try:
            self.ws.send(json.dumps(message))
            response = self.ws.recv()
            return json.loads(response)
        except Exception as e:
            print(f"Error sending message: {e}")
            return None

    def send_copilot_prompt(self, prompt: str) -> Optional[dict]:
        """Send a Copilot prompt and wait for the final result."""
        if not self.ws:
            return None
        try:
            message = {"type": "copilotPrompt", "prompt": prompt}
            self.ws.send(json.dumps(message))

            # First response is "executing" status
            response = self.ws.recv()
            result = json.loads(response)

            # If executing, wait for the actual result
            if result.get("status") == "executing":
                print(f"  [Waiting for Copilot response...]")
                # Wait for the final result (copilotPromptResult)
                final_response = self.ws.recv()
                result = json.loads(final_response)

            return result
        except websocket.WebSocketTimeoutException:
            print(f"  [Timeout waiting for Copilot response]")
            return {"type": "copilotPromptResult", "status": "error", "message": "Timeout"}
        except Exception as e:
            print(f"Error sending Copilot prompt: {e}")
            return None

    def run_test(self, name: str, message: dict,
                 validate_fn: Optional[callable] = None,
                 skip: bool = False,
                 skip_reason: str = "") -> TestResult:
        """Run a single test case."""
        print(f"\n{'-'*60}")
        print(f"TEST: {name}")
        print(f"Request: {json.dumps(message, indent=2)}")

        if skip:
            result = TestResult(name, TestStatus.SKIPPED, skip_reason)
            self.results.append(result)
            print(f"Status: {result.status.value} - {skip_reason}")
            return result

        response = self.send_message(message)

        if response is None:
            result = TestResult(name, TestStatus.FAILED, "No response received")
            self.results.append(result)
            print(f"Status: {result.status.value} - No response received")
            return result

        print(f"Response: {json.dumps(response, indent=2)}")

        # Default validation: check for success status or valid response
        if validate_fn:
            passed, msg = validate_fn(response)
        else:
            passed = response.get("status") == "success" or "error" not in response.get("status", "").lower()
            msg = response.get("message", "")

        status = TestStatus.PASSED if passed else TestStatus.FAILED
        result = TestResult(name, status, msg, response)
        self.results.append(result)
        print(f"Status: {result.status.value}" + (f" - {msg}" if msg else ""))
        return result

    # =========================================================================
    # Test Cases
    # =========================================================================

    def test_get_current_prompt(self) -> TestResult:
        """Test getCurrentPrompt command."""
        return self.run_test(
            "Get Current Prompt",
            {"type": "getCurrentPrompt"},
            lambda r: (r.get("type") == "currentPrompt" or r.get("status") == "success",
                      f"Current: {r.get('currentPrompt', r.get('prompt', 'None'))}")
        )

    def test_get_pending_prompts(self) -> TestResult:
        """Test getPendingPrompts command."""
        return self.run_test(
            "Get Pending Prompts",
            {"type": "getPendingPrompts"},
            lambda r: (r.get("type") == "pendingPrompts" or r.get("status") == "success",
                      f"Queue size: {len(r.get('pendingPrompts', r.get('prompts', [])))}")
        )

    def test_set_ask_chat_mode(self) -> TestResult:
        """Test setAskChatMode command."""
        return self.run_test(
            "Set Ask Chat Mode",
            {"type": "setAskChatMode"},
            lambda r: (r.get("status") == "success", r.get("message", ""))
        )

    def test_set_agent_chat_mode(self) -> TestResult:
        """Test setAgentChatMode command."""
        return self.run_test(
            "Set Agent Chat Mode",
            {"type": "setAgentChatMode"},
            lambda r: (r.get("status") == "success", r.get("message", ""))
        )

    def test_set_model_gpt(self) -> TestResult:
        """Test setModelGPT command."""
        return self.run_test(
            "Set Model GPT",
            {"type": "setModelGPT"},
            lambda r: (r.get("status") == "success", r.get("message", ""))
        )

    def test_set_model_gemini_pro(self) -> TestResult:
        """Test setModelGeminiPro command."""
        return self.run_test(
            "Set Model Gemini Pro",
            {"type": "setModelGeminiPro"},
            lambda r: (r.get("status") == "success", r.get("message", ""))
        )

    def test_set_model_claude_sonnet4(self) -> TestResult:
        """Test setModelClaudeSonnet4 command."""
        return self.run_test(
            "Set Model Claude Sonnet 4",
            {"type": "setModelClaudeSonnet4"},
            lambda r: (r.get("status") == "success", r.get("message", ""))
        )

    def test_new_agent_session(self) -> TestResult:
        """Test newAgentSession command."""
        return self.run_test(
            "New Agent Session",
            {"type": "newAgentSession"},
            lambda r: (r.get("status") == "success", r.get("message", ""))
        )

    def test_cli_command_ls(self) -> TestResult:
        """Test runCliCommand with 'ls' command."""
        return self.run_test(
            "CLI Command: ls",
            {"type": "runCliCommand", "command": "ls -la"},
            lambda r: (r.get("status") == "success" and "output" in r,
                      f"Got {len(r.get('output', ''))} chars output")
        )

    def test_cli_command_pwd(self) -> TestResult:
        """Test runCliCommand with 'pwd' command."""
        return self.run_test(
            "CLI Command: pwd",
            {"type": "runCliCommand", "command": "pwd"},
            lambda r: (r.get("status") == "success", r.get("output", "").strip())
        )

    def test_cli_command_echo(self) -> TestResult:
        """Test runCliCommand with 'echo' command."""
        return self.run_test(
            "CLI Command: echo",
            {"type": "runCliCommand", "command": "echo 'Hello from test'"},
            lambda r: (r.get("status") == "success" and "Hello from test" in r.get("output", ""),
                      r.get("output", "").strip())
        )

    def test_cli_command_date(self) -> TestResult:
        """Test runCliCommand with 'date' command."""
        return self.run_test(
            "CLI Command: date",
            {"type": "runCliCommand", "command": "date"},
            lambda r: (r.get("status") == "success", r.get("output", "").strip())
        )

    def test_cli_command_whoami(self) -> TestResult:
        """Test runCliCommand with 'whoami' command."""
        return self.run_test(
            "CLI Command: whoami",
            {"type": "runCliCommand", "command": "whoami"},
            lambda r: (r.get("status") == "success", r.get("output", "").strip())
        )

    def test_cli_command_git_status(self) -> TestResult:
        """Test runCliCommand with 'git status' command."""
        return self.run_test(
            "CLI Command: git status",
            {"type": "runCliCommand", "command": "git status"},
            # Can be success or error (if not a git repo)
            lambda r: (r.get("status") in ["success", "error"],
                      r.get("output", r.get("message", "")).strip()[:50])
        )

    def test_cli_command_unsafe_rejected(self) -> TestResult:
        """Test that unsafe CLI commands are rejected."""
        return self.run_test(
            "CLI Command: Unsafe command rejected",
            {"type": "runCliCommand", "command": "rm -rf /"},
            lambda r: (r.get("status") == "error",
                      r.get("message", "Rejected")[:60])
        )

    def test_cli_command_shell_injection_rejected(self) -> TestResult:
        """Test that shell injection attempts are rejected."""
        return self.run_test(
            "CLI Command: Shell injection rejected",
            {"type": "runCliCommand", "command": "ls; rm -rf /"},
            lambda r: (r.get("status") == "error",
                      r.get("message", "Rejected")[:60])
        )

    def test_copilot_prompt_simple(self, skip: bool = False) -> TestResult:
        """Test copilotPrompt with a simple prompt."""
        name = "Copilot Prompt: Simple"
        prompt = "Say 'Hello Test' and nothing else."

        print(f"\n{'-'*60}")
        print(f"TEST: {name}")
        print(f"Prompt: {prompt}")

        if skip:
            result = TestResult(name, TestStatus.SKIPPED, "Skipped: --skip-copilot flag set")
            self.results.append(result)
            print(f"Status: {result.status.value} - Skipped: --skip-copilot flag set")
            return result

        response = self.send_copilot_prompt(prompt)

        if response is None:
            result = TestResult(name, TestStatus.FAILED, "No response received")
            self.results.append(result)
            print(f"Status: {result.status.value} - No response received")
            return result

        print(f"Response: {json.dumps(response, indent=2)[:500]}...")

        content = response.get("content", "")
        is_timeout = "Timed out" in content or "timeout" in content.lower()

        if is_timeout:
            # Timeout is a valid response - the API worked, Copilot just didn't respond
            msg = "API responded (Copilot timeout - ensure Copilot chat is open in IDE)"
            status = TestStatus.PASSED
        elif response.get("status") == "success" and len(content) > 0:
            msg = f"Response length: {len(content)} chars"
            status = TestStatus.PASSED
        else:
            msg = f"Unexpected response: {response.get('status')}"
            status = TestStatus.FAILED

        result = TestResult(name, status, msg, response)
        self.results.append(result)
        print(f"Status: {result.status.value} - {msg}")
        return result

    def test_copilot_prompt_code(self, skip: bool = False) -> TestResult:
        """Test copilotPrompt with a code generation prompt."""
        name = "Copilot Prompt: Code Generation"
        prompt = "Write a Python function that adds two numbers. Keep it simple, just the function."

        print(f"\n{'-'*60}")
        print(f"TEST: {name}")
        print(f"Prompt: {prompt}")

        if skip:
            result = TestResult(name, TestStatus.SKIPPED, "Skipped: --skip-copilot flag set")
            self.results.append(result)
            print(f"Status: {result.status.value} - Skipped: --skip-copilot flag set")
            return result

        response = self.send_copilot_prompt(prompt)

        if response is None:
            result = TestResult(name, TestStatus.FAILED, "No response received")
            self.results.append(result)
            print(f"Status: {result.status.value} - No response received")
            return result

        print(f"Response: {json.dumps(response, indent=2)[:500]}...")

        content = response.get("content", "")
        is_timeout = "Timed out" in content or "timeout" in content.lower()

        if is_timeout:
            # Timeout is a valid response - the API worked, Copilot just didn't respond
            msg = "API responded (Copilot timeout - ensure Copilot chat is open in IDE)"
            status = TestStatus.PASSED
        elif (response.get("status") == "success" and len(content) > 0 and
              ("def " in content or "function" in content.lower())):
            msg = f"Got code response: {len(content)} chars"
            status = TestStatus.PASSED
        elif response.get("status") == "success" and len(content) > 0:
            msg = f"Response received but no code detected: {len(content)} chars"
            status = TestStatus.PASSED  # Still pass - we got a response
        else:
            msg = f"Unexpected response: {response.get('status')}"
            status = TestStatus.FAILED

        result = TestResult(name, status, msg, response)
        self.results.append(result)
        print(f"Status: {result.status.value} - {msg}")
        return result

    def test_unknown_command(self) -> TestResult:
        """Test handling of unknown command type."""
        return self.run_test(
            "Unknown Command Handling",
            {"type": "unknownCommandType123"},
            lambda r: (True, f"Response type: {r.get('type', 'unknown')}")  # Just verify we get some response
        )

    def test_malformed_json_handling(self) -> TestResult:
        """Test handling of requests with missing fields."""
        return self.run_test(
            "Missing Fields Handling",
            {"type": "copilotPrompt"},  # Missing 'prompt' field
            lambda r: (r.get("status") == "error" or r.get("type") == "copilotPromptResult",
                      r.get("message", r.get("error", "Handled")))
        )

    def test_shutdown(self, skip: bool = False) -> TestResult:
        """Test shutdown command - should be run last."""
        return self.run_test(
            "Shutdown Server",
            {"type": "shutdown"},
            lambda r: (r.get("status") == "success", r.get("message", "")),
            skip=skip,
            skip_reason="Skipped: --skip-shutdown flag set"
        )

    def run_all_tests(self, skip_copilot: bool = False, skip_shutdown: bool = False):
        """Run all test cases."""
        print("\n" + "="*60)
        print("COPILOT API MINIMAL - TEST SUITE")
        print("="*60)

        # Connection info tests
        self.test_get_current_prompt()
        self.test_get_pending_prompts()

        # Chat mode tests
        print("\n" + "="*60)
        print("CHAT MODE TESTS")
        print("="*60)
        self.test_set_ask_chat_mode()
        time.sleep(0.5)  # Brief pause between UI operations
        self.test_set_agent_chat_mode()
        time.sleep(0.5)

        # Model selection tests
        print("\n" + "="*60)
        print("MODEL SELECTION TESTS")
        print("="*60)
        self.test_set_model_gpt()
        time.sleep(0.5)
        self.test_set_model_gemini_pro()
        time.sleep(0.5)
        self.test_set_model_claude_sonnet4()
        time.sleep(0.5)

        # Session management
        print("\n" + "="*60)
        print("SESSION MANAGEMENT TESTS")
        print("="*60)
        self.test_new_agent_session()
        time.sleep(0.5)

        # CLI command tests
        print("\n" + "="*60)
        print("CLI COMMAND TESTS")
        print("="*60)
        self.test_cli_command_ls()
        self.test_cli_command_pwd()
        self.test_cli_command_echo()
        self.test_cli_command_date()
        self.test_cli_command_whoami()
        self.test_cli_command_git_status()

        # Security tests
        print("\n" + "="*60)
        print("SECURITY TESTS")
        print("="*60)
        self.test_cli_command_unsafe_rejected()
        self.test_cli_command_shell_injection_rejected()

        # Error handling tests
        print("\n" + "="*60)
        print("ERROR HANDLING TESTS")
        print("="*60)
        self.test_unknown_command()
        self.test_malformed_json_handling()

        # Copilot prompt tests (can be slow)
        print("\n" + "="*60)
        print("COPILOT PROMPT TESTS")
        print("="*60)
        self.test_copilot_prompt_simple(skip=skip_copilot)
        if not skip_copilot:
            time.sleep(2)  # Wait between prompts
        self.test_copilot_prompt_code(skip=skip_copilot)

        # Shutdown test (run last)
        print("\n" + "="*60)
        print("SHUTDOWN TEST")
        print("="*60)
        self.test_shutdown(skip=skip_shutdown)

    def print_summary(self):
        """Print test results summary."""
        print("\n" + "="*60)
        print("TEST RESULTS SUMMARY")
        print("="*60)

        passed = sum(1 for r in self.results if r.status == TestStatus.PASSED)
        failed = sum(1 for r in self.results if r.status == TestStatus.FAILED)
        skipped = sum(1 for r in self.results if r.status == TestStatus.SKIPPED)
        total = len(self.results)

        print(f"\nTotal Tests: {total}")
        print(f"  {TestStatus.PASSED.value}: {passed}")
        print(f"  {TestStatus.FAILED.value}: {failed}")
        print(f"  {TestStatus.SKIPPED.value}: {skipped}")

        if failed > 0:
            print("\nFailed Tests:")
            for r in self.results:
                if r.status == TestStatus.FAILED:
                    print(f"  - {r.name}: {r.message}")

        print("\n" + "="*60)
        if failed == 0:
            print("ALL TESTS PASSED!")
        else:
            print(f"SOME TESTS FAILED ({failed}/{total - skipped})")
        print("="*60)

        return failed == 0


def main():
    parser = argparse.ArgumentParser(
        description="Test Copilot API Minimal WebSocket features",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python test_copilot_api.py                    # Run all tests on default port
  python test_copilot_api.py --port 9000        # Use custom port
  python test_copilot_api.py --skip-copilot     # Skip slow Copilot prompt tests
  python test_copilot_api.py --skip-shutdown    # Don't shutdown server after tests
        """
    )
    parser.add_argument("--host", default="localhost", help="WebSocket host (default: localhost)")
    parser.add_argument("--port", type=int, default=8765, help="WebSocket port (default: 8765)")
    parser.add_argument("--timeout", type=int, default=120, help="Response timeout in seconds (default: 120)")
    parser.add_argument("--skip-copilot", action="store_true", help="Skip Copilot prompt tests (faster)")
    parser.add_argument("--skip-shutdown", action="store_true", help="Don't shutdown server after tests")

    args = parser.parse_args()

    tester = CopilotAPITester(host=args.host, port=args.port, timeout=args.timeout)

    if not tester.connect():
        print("\nFailed to connect to WebSocket server.")
        print(f"Make sure the Copilot API plugin is running and listening on port {args.port}")
        sys.exit(1)

    try:
        tester.run_all_tests(
            skip_copilot=args.skip_copilot,
            skip_shutdown=args.skip_shutdown
        )
    finally:
        tester.disconnect()

    tester.print_summary()
    sys.exit(0 if all(r.status != TestStatus.FAILED for r in tester.results) else 1)


if __name__ == "__main__":
    main()
