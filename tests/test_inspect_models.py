#!/usr/bin/env python3
"""Inspect the ModelPickPanel to understand its structure."""

from client import CopilotClient, get_port

def main():
    host, port, timeout = get_port()

    with CopilotClient(host, port, timeout) as client:
        response = client.send({"type": "inspectModels"})

        print("\n" + "="*60)
        print("ModelPickPanel Inspection")
        print("="*60)

        if response.get("status") == "success":
            report = response.get("report", "No report")
            print(report)
            return True
        else:
            print(f"Error: {response.get('message', 'Unknown error')}")
            return False

if __name__ == "__main__":
    exit(0 if main() else 1)
