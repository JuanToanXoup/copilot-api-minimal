#!/usr/bin/env python3
"""Test: Start a new agent session."""

from client import CopilotClient, get_port, print_result

def main():
    host, port, timeout = get_port()

    with CopilotClient(host, port, timeout) as client:
        response = client.send({"type": "newAgentSession"})
        return print_result("New Agent Session", response)

if __name__ == "__main__":
    exit(0 if main() else 1)
