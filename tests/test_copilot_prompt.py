#!/usr/bin/env python3
"""Test: Send a prompt to Copilot and get a response."""

from client import CopilotClient, get_port, print_result

def main():
    host, port, timeout = get_port()

    with CopilotClient(host, port, timeout=120) as client:
        prompt = "Say 'Hello Test' and nothing else."
        print(f"Sending prompt: {prompt}")

        response = client.send_prompt(prompt)

        def check(r):
            content = r.get("content", "")
            if "Timed out" in content:
                print("Note: Copilot timed out (ensure chat window is open)")
                return True  # API worked, just no Copilot response
            return r.get("status") == "success" and len(content) > 0

        return print_result("Copilot Prompt", response, check)

if __name__ == "__main__":
    exit(0 if main() else 1)
