"""Type definitions for the dashboard backend."""

from typing import TypedDict, Literal, Optional, Any


HealthStatus = Literal["healthy", "stale", "disconnected"]


class AgentState(TypedDict, total=False):
    """Internal state for a connected agent."""
    connected: bool
    config: dict
    last_heartbeat: Optional[str]
    health: HealthStatus


class AgentSummary(TypedDict):
    """Agent data sent to dashboard clients."""
    instance_id: str
    port: Optional[int]
    project_path: str
    project_name: str
    role: Optional[str]
    capabilities: list[str]
    agent_name: Optional[str]
    connected: bool
    last_heartbeat: Optional[str]
    health: HealthStatus


class RegistryEntry(TypedDict, total=False):
    """Entry in the agent registry file."""
    port: int
    projectPath: str
    role: str
    capabilities: list[str]
    agentName: str


class ActivityEvent(TypedDict, total=False):
    """Activity log event."""
    timestamp: str
    event_type: str
    port: int
    instance_id: str
    role: Optional[str]
    prompt: Optional[str]
    response: Optional[str]
    status: Optional[str]


class PromptResult(TypedDict, total=False):
    """Result from sending a prompt to an agent."""
    error: Optional[str]
    content: Optional[str]
    type: str
    prompt: str
    status: str
    request_id: str


class FlowSummary(TypedDict):
    """Summary of a saved flow."""
    name: str
    description: str
    templateId: Optional[str]
    nodeCount: int
    edgeCount: int
    createdAt: Optional[str]
    updatedAt: Optional[str]
