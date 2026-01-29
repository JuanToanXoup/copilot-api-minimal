#!/usr/bin/env python3
"""Test: Shutdown the WebSocket server."""

from client import CopilotClient, get_port, print_result

def main():
    host, port, timeout = get_port()

    with CopilotClient(host, port, timeout) as client:
        response = client.send({"type": "shutdown"})
        return print_result("Shutdown Server", response)

if __name__ == "__main__":
    exit(0 if main() else 1)
