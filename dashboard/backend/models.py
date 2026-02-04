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
    capabilities: list[str]
    connected: bool
    last_heartbeat: Optional[str]
    health: HealthStatus


class RegistryEntry(TypedDict, total=False):
    """Entry in the agent registry file."""
    port: int
    projectPath: str
    capabilities: list[str]


class ActivityEvent(TypedDict, total=False):
    """Activity log event."""
    timestamp: str
    event_type: str
    port: int
    instance_id: str
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


# ==================== Pipeline Execution Models ====================

FailureStatus = Literal["pending", "running", "completed", "failed", "escalated"]
TaskStatus = Literal["pending", "assigned", "running", "completed", "failed", "skipped"]


class FailureInput(TypedDict, total=False):
    """Input for creating a failure."""
    test_file: str
    test_name: str
    error_message: str
    stack_trace: Optional[str]
    expected: Optional[str]
    actual: Optional[str]
    context: Optional[dict]  # Additional context (DOM, selectors, etc.)


class Failure(TypedDict):
    """A test failure being processed through the pipeline."""
    id: str
    test_file: str
    test_name: str
    error_message: str
    stack_trace: Optional[str]
    expected: Optional[str]
    actual: Optional[str]
    context: dict
    status: FailureStatus
    workflow_id: Optional[str]
    current_node_id: Optional[str]
    created_at: str
    updated_at: str
    completed_at: Optional[str]
    retry_count: int
    node_results: dict[str, Any]  # Results from each executed node


class TaskExecution(TypedDict):
    """Execution state for a single pipeline task/node."""
    id: str
    failure_id: str
    node_id: str
    node_type: str
    node_label: str
    status: TaskStatus
    assigned_agent_id: Optional[str]
    input_data: dict
    output_data: Optional[dict]
    error: Optional[str]
    started_at: Optional[str]
    completed_at: Optional[str]
    retry_count: int


class PipelineState(TypedDict):
    """Overall state of a pipeline execution."""
    failure_id: str
    workflow_id: str
    status: FailureStatus
    execution_order: list[str]  # Node IDs in execution order
    current_index: int
    node_outputs: dict[str, Any]  # Outputs keyed by node ID
    tasks: dict[str, TaskExecution]  # Task state keyed by node ID
