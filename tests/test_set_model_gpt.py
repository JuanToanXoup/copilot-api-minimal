#!/usr/bin/env python3
"""Test: Set Copilot model to GPT-4o."""

from client import CopilotClient, get_port, print_result

def main():
    host, port, timeout = get_port()

    with CopilotClient(host, port, timeout) as client:
        response = client.send({"type": "setModelGPT4o"})
        return print_result("Set Model GPT-4o", response)

if __name__ == "__main__":
    exit(0 if main() else 1)
