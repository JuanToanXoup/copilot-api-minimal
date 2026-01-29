#!/usr/bin/env python3
"""Start recording AWT events for debugging UI interactions."""

from client import CopilotClient, get_port

def main():
    host, port, timeout = get_port()

    with CopilotClient(host, port, timeout) as client:
        response = client.send({"type": "startEventRecording"})
        print(f"Response: {response}")
        print("\n>>> Now manually interact with the UI (e.g., click ChatModeComboBox and select Agent)")
        print(">>> Then run: python stop_recording.py")

if __name__ == "__main__":
    main()
