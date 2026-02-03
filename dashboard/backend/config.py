"""Configuration constants for the dashboard backend."""

from pathlib import Path

# Paths
REGISTRY_PATH = Path.home() / ".citi-agent" / "registry.json"
FLOWS_DIR = Path.home() / ".citi-agent" / "flows"

# Timeouts (seconds)
WS_CONNECT_TIMEOUT = 5
WS_RECV_TIMEOUT = 5
PROMPT_TIMEOUT = 120
HEARTBEAT_PING_TIMEOUT = 5

# Intervals (seconds)
HEARTBEAT_INTERVAL = 10
STALE_THRESHOLD = 30
REGISTRY_POLL_INTERVAL = 10  # Fallback when watchdog misses events

# Limits
MAX_ACTIVITY_LOG = 100
