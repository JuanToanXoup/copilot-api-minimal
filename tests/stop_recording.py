#!/usr/bin/env python3
"""Stop recording AWT events and display captured events."""

from client import CopilotClient, get_port

def main():
    host, port, timeout = get_port()

    with CopilotClient(host, port, timeout) as client:
        response = client.send({"type": "stopEventRecording"})

        event_count = response.get("eventCount", 0)
        events = response.get("events", [])

        print(f"Captured {event_count} events:\n")
        print("=" * 80)

        for event in events:
            print(event)

        print("=" * 80)
        print(f"\nTotal: {event_count} events")

if __name__ == "__main__":
    main()
