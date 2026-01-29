#!/usr/bin/env python3
"""Test: Run UI diagnostics."""

from client import CopilotClient, get_port, print_result

def main():
    host, port, timeout = get_port()

    with CopilotClient(host, port, timeout) as client:
        response = client.send({"type": "diagnoseUI"})

        def check(r):
            return r.get("type") == "diagnostics" or "report" in r

        return print_result("Diagnose UI", response, check)

if __name__ == "__main__":
    exit(0 if main() else 1)
