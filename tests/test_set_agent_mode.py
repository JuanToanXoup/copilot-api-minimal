#!/usr/bin/env python3
"""Test: Set Copilot to Agent chat mode."""

from client import CopilotClient, get_port, print_result

def main():
    host, port, timeout = get_port()

    with CopilotClient(host, port, timeout) as client:
        response = client.send({"type": "setAgentChatMode"})
        return print_result("Set Agent Chat Mode", response)

if __name__ == "__main__":
    exit(0 if main() else 1)
