"""
Shared WebSocket client for Copilot API tests.
"""

import json
import sys
import os

try:
    import websocket
except ImportError:
    print("Error: websocket-client required. Install with: pip install websocket-client")
    sys.exit(1)


class CopilotClient:
    """Simple WebSocket client for Copilot API."""

    def __init__(self, host="localhost", port=8765, timeout=30):
        self.host = host
        self.port = port
        self.timeout = timeout
        self.ws = None
        self.agent_config = None

    def connect(self):
        """Connect to the WebSocket server."""
        url = f"ws://{self.host}:{self.port}"
        print(f"Connecting to {url}...")
        self.ws = websocket.create_connection(url, timeout=self.timeout)

        # Server sends agent config on connect
        initial = self.ws.recv()
        self.agent_config = json.loads(initial)
        print(f"Connected. Agent: {self.agent_config.get('agentName', 'Unknown')}")
        return self

    def disconnect(self):
        """Close the connection."""
        if self.ws:
            self.ws.close()
            print("Disconnected.")

    def send(self, message):
        """Send a message and receive response."""
        self.ws.send(json.dumps(message))
        response = self.ws.recv()
        return json.loads(response)

    def send_prompt(self, prompt):
        """Send a Copilot prompt and wait for result."""
        self.ws.send(json.dumps({"type": "copilotPrompt", "prompt": prompt}))

        # First response is "executing"
        response = json.loads(self.ws.recv())

        if response.get("status") == "executing":
            print("Waiting for Copilot response...")
            # Wait for final result
            response = json.loads(self.ws.recv())

        return response

    def __enter__(self):
        return self.connect()

    def __exit__(self, *args):
        self.disconnect()


def get_port():
    """Get port from command line, registry file, or use default."""
    import argparse

    def find_registry_port():
        """Find port from centralized registry at ~/.citi-agent/registry.json."""
        # Determine project root (parent of tests directory)
        tests_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.dirname(tests_dir)

        # Read from centralized registry
        registry_path = os.path.join(os.path.expanduser("~"), ".citi-agent", "registry.json")

        if os.path.exists(registry_path):
            try:
                with open(registry_path, "r") as f:
                    registry = json.load(f)

                    # Find instances for this project path
                    for instance_id, entry in registry.items():
                        entry_path = entry.get("projectPath", "")
                        if entry_path == project_root:
                            port = entry.get("port")
                            if port and port > 0:
                                print(f"Using port {port} from registry for project: {project_root}")
                                return port

                    # If project not found by exact path, try to find any entry that ends with our project name
                    project_name = os.path.basename(project_root)
                    for instance_id, entry in registry.items():
                        entry_path = entry.get("projectPath", "")
                        if entry_path.endswith(project_name):
                            port = entry.get("port")
                            if port and port > 0:
                                print(f"Using port {port} from registry (matched by name: {project_name})")
                                return port
            except Exception as e:
                print(f"Warning: Could not read registry file: {e}")

        return None

    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=None, help="WebSocket port")
    parser.add_argument("--host", default="localhost", help="WebSocket host")
    parser.add_argument("--timeout", type=int, default=30, help="Timeout in seconds")
    args, _ = parser.parse_known_args()

    # Priority: command line > registry file > default
    if args.port is None:
        args.port = find_registry_port() or 8765

    return args.host, args.port, args.timeout


def print_result(name, response, success_check=None):
    """Print test result."""
    print(f"\n{'='*50}")
    print(f"TEST: {name}")
    print(f"{'='*50}")
    print(f"Response: {json.dumps(response, indent=2)[:500]}")

    if success_check:
        passed = success_check(response)
    else:
        passed = response.get("status") == "success"

    status = "PASSED" if passed else "FAILED"
    print(f"\nResult: {status}")
    return passed
