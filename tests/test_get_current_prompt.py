#!/usr/bin/env python3
"""Test: Get the currently executing prompt."""

from client import CopilotClient, get_port, print_result

def main():
    host, port, timeout = get_port()

    with CopilotClient(host, port, timeout) as client:
        response = client.send({"type": "getCurrentPrompt"})

        def check(r):
            return r.get("type") == "currentPrompt" or r.get("status") == "success"

        return print_result("Get Current Prompt", response, check)

if __name__ == "__main__":
    exit(0 if main() else 1)
