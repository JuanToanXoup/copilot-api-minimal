#!/usr/bin/env python3
"""Test: Set Copilot model to Claude Sonnet 4 (exact match)."""

from client import CopilotClient, get_port, print_result

def main():
    host, port, timeout = get_port()

    with CopilotClient(host, port, timeout) as client:
        response = client.send({"type": "setModelClaudeSonnet4"})
        return print_result("Set Model Claude Sonnet 4", response)

if __name__ == "__main__":
    exit(0 if main() else 1)
