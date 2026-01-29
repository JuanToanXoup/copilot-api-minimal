#!/usr/bin/env python3
"""List all chat modes and their names to find the correct indices."""

from client import CopilotClient, get_port

def main():
    host, port, timeout = get_port()

    with CopilotClient(host, port, timeout) as client:
        response = client.send({"type": "inspectChatMode"})

        print("\n" + "="*60)
        print("Chat Mode Items")
        print("="*60)

        if response.get("status") == "success":
            report = response.get("report", "No report")
            # Just print the items section
            lines = report.split('\n')
            in_items = False
            in_mode_methods = False
            for line in lines:
                if 'items:' in line:
                    in_items = True
                    print(line)
                elif in_items and line.strip().startswith('['):
                    print(line)
                elif in_items and not line.strip().startswith('['):
                    in_items = False

                if 'ChatModeItem' in line and 'Methods' in line:
                    in_mode_methods = True
                    print("\n" + line)
                elif in_mode_methods and line.strip().startswith('  '):
                    print(line)
                elif in_mode_methods and not line.strip().startswith('  ') and line.strip():
                    in_mode_methods = False

            return True
        else:
            print(f"Error: {response.get('message', 'Unknown error')}")
            return False

if __name__ == "__main__":
    exit(0 if main() else 1)
