#!/usr/bin/env python3
"""Test: Get the queue of pending prompts."""

from client import CopilotClient, get_port, print_result

def main():
    host, port, timeout = get_port()

    with CopilotClient(host, port, timeout) as client:
        response = client.send({"type": "getPendingPrompts"})

        def check(r):
            return r.get("type") == "pendingPrompts" or r.get("status") == "success"

        return print_result("Get Pending Prompts", response, check)

if __name__ == "__main__":
    exit(0 if main() else 1)
