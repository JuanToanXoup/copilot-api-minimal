#!/usr/bin/env python3
"""Test: Ping the WebSocket server."""

import json
import sys

try:
    import websocket
except ImportError:
    print("Error: websocket-client required. Install with: pip install websocket-client")
    sys.exit(1)

from client import get_port

def main():
    host, port, timeout = get_port()

    url = f"ws://{host}:{port}"
    print(f"Connecting to {url}...")

    ws = websocket.create_connection(url, timeout=timeout)

    # Receive agent config
    ws.recv()
    print("Connected.")

    # Send ping
    print("Sending ping...")
    ws.send("ping")

    response = ws.recv()
    ws.close()

    print(f"\n{'='*50}")
    print("TEST: Ping/Pong")
    print(f"{'='*50}")
    print(f"Response: {response}")

    passed = response == "pong"
    print(f"\nResult: {'PASSED' if passed else 'FAILED'}")

    return passed

if __name__ == "__main__":
    exit(0 if main() else 1)
