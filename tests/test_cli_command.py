#!/usr/bin/env python3
"""Test: Run a CLI command."""

import sys
from client import CopilotClient, get_port, print_result

def main():
    host, port, timeout = get_port()

    # Get command from args or use default
    command = "echo 'Hello from CLI test'"
    for i, arg in enumerate(sys.argv):
        if arg == "--command" and i + 1 < len(sys.argv):
            command = sys.argv[i + 1]
            break

    with CopilotClient(host, port, timeout) as client:
        print(f"Running command: {command}")
        response = client.send({"type": "runCliCommand", "command": command})

        def check(r):
            return r.get("status") == "success" and "output" in r

        return print_result(f"CLI Command: {command}", response, check)

if __name__ == "__main__":
    exit(0 if main() else 1)
