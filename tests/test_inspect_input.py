#!/usr/bin/env python3
"""Test: Inspect the chat input component."""

from client import CopilotClient, get_port, print_result

def main():
    host, port, timeout = get_port()

    with CopilotClient(host, port, timeout) as client:
        response = client.send({"type": "inspectInput"})

        def check(r):
            return r.get("status") == "success" and "report" in r

        return print_result("Inspect Input", response, check)

if __name__ == "__main__":
    exit(0 if main() else 1)
