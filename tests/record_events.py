#!/usr/bin/env python3
"""Record AWT events for debugging UI interactions."""

import signal
import sys
from client import CopilotClient, get_port

client = None

def stop_and_show(signum=None, frame=None):
    """Stop recording and display events."""
    global client
    if client and client.ws:
        print("\n\nStopping recording...")
        response = client.send({"type": "stopEventRecording"})

        event_count = response.get("eventCount", 0)
        events = response.get("events", [])

        print(f"\nCaptured {event_count} events:\n")
        print("=" * 80)

        for event in events:
            print(event)

        print("=" * 80)
        print(f"\nTotal: {event_count} events")

        client.disconnect()
    sys.exit(0)

def main():
    global client
    host, port, timeout = get_port()

    client = CopilotClient(host, port, timeout)
    client.connect()

    # Handle Ctrl+C
    signal.signal(signal.SIGINT, stop_and_show)

    response = client.send({"type": "startEventRecording"})
    print(f"Recording started: {response.get('status')}")
    print("\n" + "=" * 80)
    print(">>> Recording UI events...")
    print(">>> Interact with the UI now (click ChatModeComboBox, select Agent, etc.)")
    print(">>> Press ENTER or Ctrl+C when done")
    print("=" * 80 + "\n")

    try:
        input()
    except EOFError:
        pass

    stop_and_show()

if __name__ == "__main__":
    main()
