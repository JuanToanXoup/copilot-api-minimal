"""Pipeline executor service - runs workflows against failures."""

import asyncio
import json
import re
import uuid
from datetime import datetime
from pathlib import Path
from typing import TYPE_CHECKING, Any, Optional

import httpx

from config import get_project_paths
from models import (
    Failure,
    FailureInput,
    TaskExecution,
    PipelineState,
    FailureStatus,
    TaskStatus,
)

if TYPE_CHECKING:
    from services.broadcast import BroadcastService
    from services.agent_manager import AgentManager


class PipelineExecutor:
    """Executes workflow pipelines against test failures."""

    def __init__(
        self,
        agent_manager: "AgentManager",
        broadcast: "BroadcastService",
    ):
        self.agent_manager = agent_manager
        self.broadcast = broadcast
        self.failures: dict[str, Failure] = {}
        self.pipelines: dict[str, PipelineState] = {}
        self.active_workflow_id: Optional[str] = None
        self._execution_queue: asyncio.Queue = asyncio.Queue()
        self._running = False

    # ==================== Failure Management ====================

    def create_failure(self, input_data: FailureInput) -> Failure:
        """Create a new failure record."""
        failure_id = f"fail-{uuid.uuid4().hex[:8]}"
        now = datetime.now().isoformat()

        failure: Failure = {
            "id": failure_id,
            "test_file": input_data.get("test_file", "unknown"),
            "test_name": input_data.get("test_name", "unknown"),
            "error_message": input_data.get("error_message", ""),
            "stack_trace": input_data.get("stack_trace"),
            "expected": input_data.get("expected"),
            "actual": input_data.get("actual"),
            "context": input_data.get("context", {}),
            "status": "pending",
            "workflow_id": None,
            "current_node_id": None,
            "created_at": now,
            "updated_at": now,
            "completed_at": None,
            "retry_count": 0,
            "node_results": {},
        }

        self.failures[failure_id] = failure
        asyncio.create_task(self._broadcast_failure_created(failure))
        return failure

    def get_failure(self, failure_id: str) -> Optional[Failure]:
        """Get a failure by ID."""
        return self.failures.get(failure_id)

    def get_all_failures(self) -> list[Failure]:
        """Get all failures, sorted by created_at descending."""
        return sorted(
            self.failures.values(),
            key=lambda f: f["created_at"],
            reverse=True,
        )

    def get_failures_by_status(self, status: FailureStatus) -> list[Failure]:
        """Get failures with a specific status."""
        return [f for f in self.failures.values() if f["status"] == status]

    # ==================== Workflow Management ====================

    def set_active_workflow(self, workflow_id: str) -> None:
        """Set the active workflow for processing failures."""
        self.active_workflow_id = workflow_id

    def get_active_workflow(self) -> Optional[str]:
        """Get the current active workflow ID."""
        return self.active_workflow_id

    def load_workflow(self, workflow_id: str, project_path: str | None = None) -> Optional[dict]:
        """Load a workflow definition from storage."""
        paths = get_project_paths(project_path)
        flows_dir = paths["flows_dir"]

        # Try to find the workflow file
        flow_path = flows_dir / f"{workflow_id}.json"
        if not flow_path.exists():
            # Search in subfolders
            for file in flows_dir.rglob("*.json"):
                if file.stem == workflow_id:
                    flow_path = file
                    break

        if not flow_path.exists():
            return None

        try:
            with open(flow_path) as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading workflow {workflow_id}: {e}")
            return None

    # ==================== Pipeline Execution ====================

    async def queue_failure(self, failure_id: str, workflow_id: str | None = None) -> bool:
        """Queue a failure for pipeline execution."""
        failure = self.failures.get(failure_id)
        if not failure:
            return False

        wf_id = workflow_id or self.active_workflow_id
        if not wf_id:
            return False

        failure["workflow_id"] = wf_id
        failure["status"] = "pending"
        failure["updated_at"] = datetime.now().isoformat()

        await self._execution_queue.put(failure_id)
        return True

    async def start(self) -> None:
        """Start the pipeline execution loop."""
        self._running = True
        while self._running:
            try:
                # Wait for a failure to process
                failure_id = await asyncio.wait_for(
                    self._execution_queue.get(),
                    timeout=1.0,
                )
                await self._execute_pipeline(failure_id)
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                print(f"Pipeline execution error: {e}")

    def stop(self) -> None:
        """Stop the pipeline execution loop."""
        self._running = False

    async def _execute_pipeline(self, failure_id: str) -> None:
        """Execute a workflow pipeline for a failure."""
        failure = self.failures.get(failure_id)
        if not failure or not failure.get("workflow_id"):
            return

        workflow = self.load_workflow(failure["workflow_id"])
        if not workflow:
            failure["status"] = "failed"
            failure["updated_at"] = datetime.now().isoformat()
            await self._broadcast_failure_update(failure)
            return

        # Update failure status
        failure["status"] = "running"
        failure["updated_at"] = datetime.now().isoformat()
        await self._broadcast_failure_update(failure)

        # Get execution order
        nodes = workflow.get("nodes", [])
        edges = workflow.get("edges", [])
        execution_order = self._get_execution_order(nodes, edges)

        # Create pipeline state
        pipeline: PipelineState = {
            "failure_id": failure_id,
            "workflow_id": failure["workflow_id"],
            "status": "running",
            "execution_order": execution_order,
            "current_index": 0,
            "node_outputs": {},
            "tasks": {},
        }
        self.pipelines[failure_id] = pipeline

        # Build initial context with failure data
        context = {
            "input": json.dumps({
                "test_file": failure["test_file"],
                "test_name": failure["test_name"],
                "error_message": failure["error_message"],
                "stack_trace": failure.get("stack_trace", ""),
                "expected": failure.get("expected", ""),
                "actual": failure.get("actual", ""),
                **failure.get("context", {}),
            }),
            "failure": failure,
        }

        # Execute nodes in order
        for i, node_id in enumerate(execution_order):
            node = next((n for n in nodes if n["id"] == node_id), None)
            if not node:
                continue

            node_type = node.get("type")
            if node_type not in ("promptBlock", "httpRequest", "condition"):
                continue

            pipeline["current_index"] = i
            failure["current_node_id"] = node_id

            # Create task execution record
            task: TaskExecution = {
                "id": f"task-{uuid.uuid4().hex[:8]}",
                "failure_id": failure_id,
                "node_id": node_id,
                "node_type": node_type,
                "node_label": node.get("data", {}).get("label", node_id),
                "status": "pending",
                "assigned_agent_id": None,
                "input_data": {},
                "output_data": None,
                "error": None,
                "started_at": None,
                "completed_at": None,
                "retry_count": 0,
            }
            pipeline["tasks"][node_id] = task
            await self._broadcast_task_update(task)

            # Execute based on node type
            try:
                if node_type == "promptBlock":
                    result = await self._execute_prompt_block(node, context, task)
                elif node_type == "httpRequest":
                    result = await self._execute_http_request(node, context, task)
                elif node_type == "condition":
                    result = await self._execute_condition(node, context, task)
                else:
                    result = None

                if result is not None:
                    pipeline["node_outputs"][node_id] = result
                    context[node_id] = result
                    failure["node_results"][node_id] = result

            except Exception as e:
                task["status"] = "failed"
                task["error"] = str(e)
                task["completed_at"] = datetime.now().isoformat()
                await self._broadcast_task_update(task)

                # Mark failure as failed
                failure["status"] = "failed"
                failure["updated_at"] = datetime.now().isoformat()
                await self._broadcast_failure_update(failure)
                return

        # Pipeline completed successfully
        failure["status"] = "completed"
        failure["completed_at"] = datetime.now().isoformat()
        failure["updated_at"] = failure["completed_at"]
        failure["current_node_id"] = None
        pipeline["status"] = "completed"

        await self._broadcast_failure_update(failure)
        await self._broadcast_pipeline_complete(failure_id)

    async def _execute_prompt_block(
        self,
        node: dict,
        context: dict,
        task: TaskExecution,
    ) -> Optional[dict]:
        """Execute a promptBlock node."""
        data = node.get("data", {})
        agent_id = data.get("agentId")
        prompt_template_id = data.get("promptTemplateId")

        # If no agent specified, try to get any available connected agent
        if not agent_id:
            conn = self.agent_manager.get_connected_agent()
            if conn:
                agent_id = conn.instance_id
            else:
                task["status"] = "failed"
                task["error"] = "No agent available"
                task["completed_at"] = datetime.now().isoformat()
                await self._broadcast_task_update(task)
                raise ValueError("No agent available for promptBlock")

        # Get agent connection
        conn = self.agent_manager.get_connection(agent_id)
        if not conn or not self.agent_manager.agents.get(agent_id, {}).get("connected"):
            task["status"] = "failed"
            task["error"] = "Agent not connected"
            task["completed_at"] = datetime.now().isoformat()
            await self._broadcast_task_update(task)
            raise ValueError(f"Agent {agent_id} not connected")

        # Build prompt from template or node data
        prompt = ""

        # Try to get prompt from node's label/description as fallback
        node_label = data.get("label", "")
        node_description = data.get("description", "")

        if prompt_template_id:
            # TODO: Load prompt template from prompts API and substitute variables
            # For now, use the node label as the prompt instruction
            prompt = f"Task: {node_label}\n\nContext:\n{context.get('input', '')}"
        elif data.get("prompt"):
            prompt = data.get("prompt", "")
        else:
            # Use node label as prompt instruction with failure context
            prompt = f"""You are helping debug a test failure.

Task: {node_label}
{f'Description: {node_description}' if node_description else ''}

Failure Context:
{context.get('input', '')}

Please analyze and provide your findings."""

        # Substitute variables in prompt
        prompt = self._substitute_variables(prompt, context)

        # Update task status
        task["status"] = "running"
        task["assigned_agent_id"] = agent_id
        task["started_at"] = datetime.now().isoformat()
        task["input_data"] = {"prompt": prompt[:500]}  # Truncate for storage
        await self._broadcast_task_update(task)

        # Send prompt to agent
        result = await conn.send_prompt(prompt)

        if result.get("error"):
            task["status"] = "failed"
            task["error"] = result["error"]
            task["completed_at"] = datetime.now().isoformat()
            await self._broadcast_task_update(task)
            raise ValueError(f"Agent error: {result['error']}")

        # Extract output
        content = result.get("content", "")
        output = {
            "response": content,
            "status": result.get("status", "success"),
        }

        task["status"] = "completed"
        task["output_data"] = {"response": content[:500]}  # Truncate
        task["completed_at"] = datetime.now().isoformat()
        await self._broadcast_task_update(task)

        return output

    async def _execute_http_request(
        self,
        node: dict,
        context: dict,
        task: TaskExecution,
    ) -> Optional[dict]:
        """Execute an httpRequest node."""
        data = node.get("data", {})
        method = data.get("method", "GET")
        url = data.get("url", "")
        headers = data.get("headers", {})
        body = data.get("body", "")

        # Substitute variables
        url = self._substitute_variables(url, context)
        body = self._substitute_variables(body, context)

        task["status"] = "running"
        task["started_at"] = datetime.now().isoformat()
        task["input_data"] = {"method": method, "url": url}
        await self._broadcast_task_update(task)

        try:
            async with httpx.AsyncClient() as client:
                response = await client.request(
                    method=method,
                    url=url,
                    headers=headers,
                    content=body if body else None,
                    timeout=30.0,
                )

            output = {
                "status": response.status_code,
                "data": response.text,
                "headers": dict(response.headers),
            }

            # Try to parse JSON
            try:
                output["data"] = response.json()
            except Exception:
                pass

            task["status"] = "completed"
            task["output_data"] = {"status": response.status_code}
            task["completed_at"] = datetime.now().isoformat()
            await self._broadcast_task_update(task)

            return output

        except Exception as e:
            task["status"] = "failed"
            task["error"] = str(e)
            task["completed_at"] = datetime.now().isoformat()
            await self._broadcast_task_update(task)
            raise

    async def _execute_condition(
        self,
        node: dict,
        context: dict,
        task: TaskExecution,
    ) -> Optional[dict]:
        """Execute a condition node (evaluate and determine branch)."""
        data = node.get("data", {})
        condition = data.get("condition", "")

        task["status"] = "running"
        task["started_at"] = datetime.now().isoformat()
        await self._broadcast_task_update(task)

        # Simple condition evaluation (can be extended)
        result = self._evaluate_condition(condition, context)

        output = {"result": result, "branch": "true" if result else "false"}

        task["status"] = "completed"
        task["output_data"] = output
        task["completed_at"] = datetime.now().isoformat()
        await self._broadcast_task_update(task)

        return output

    # ==================== Helper Methods ====================

    def _get_execution_order(self, nodes: list, edges: list) -> list[str]:
        """Get topological execution order of nodes."""
        # Build adjacency list
        graph: dict[str, list[str]] = {n["id"]: [] for n in nodes}
        in_degree: dict[str, int] = {n["id"]: 0 for n in nodes}

        for edge in edges:
            source = edge.get("source")
            target = edge.get("target")
            if source in graph and target in graph:
                graph[source].append(target)
                in_degree[target] += 1

        # Find start node (workflowStart or node with in_degree 0)
        start_nodes = []
        for node in nodes:
            if node.get("type") == "workflowStart":
                start_nodes.insert(0, node["id"])
            elif in_degree[node["id"]] == 0:
                start_nodes.append(node["id"])

        # BFS topological sort
        order = []
        queue = list(start_nodes)
        visited = set()

        while queue:
            node_id = queue.pop(0)
            if node_id in visited:
                continue
            visited.add(node_id)
            order.append(node_id)

            for neighbor in graph.get(node_id, []):
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)

        return order

    def _substitute_variables(self, text: str, context: dict) -> str:
        """Substitute {{variable}} placeholders in text."""
        if not text:
            return text

        def replace_var(match):
            var_name = match.group(1)

            # Check direct context keys
            if var_name in context:
                val = context[var_name]
                if isinstance(val, dict):
                    # Look for 'response' or 'data' key
                    if "response" in val:
                        return str(val["response"])
                    if "data" in val:
                        return json.dumps(val["data"]) if isinstance(val["data"], dict) else str(val["data"])
                    return json.dumps(val)
                return str(val)

            # Check nested: nodeId.outputName
            if "." in var_name:
                parts = var_name.split(".", 1)
                node_id, output_name = parts
                if node_id in context and isinstance(context[node_id], dict):
                    node_output = context[node_id]
                    if output_name in node_output:
                        return str(node_output[output_name])

            # Default to input if available
            if "input" in context:
                return str(context["input"])

            return match.group(0)  # Keep original if not found

        return re.sub(r"\{\{(\w+(?:\.\w+)?)\}\}", replace_var, text)

    def _evaluate_condition(self, condition: str, context: dict) -> bool:
        """Evaluate a simple condition expression."""
        if not condition:
            return True

        # Simple evaluations
        condition = condition.strip().lower()

        if condition == "true":
            return True
        if condition == "false":
            return False

        # Check for "status == success" type conditions
        if "==" in condition:
            left, right = condition.split("==", 1)
            left = left.strip()
            right = right.strip().strip('"\'')

            # Get value from context
            if left in context:
                val = context[left]
                if isinstance(val, dict) and "status" in val:
                    return str(val["status"]).lower() == right.lower()
                return str(val).lower() == right.lower()

        return True  # Default to true

    # ==================== Broadcast Methods ====================

    async def _broadcast_failure_created(self, failure: Failure) -> None:
        """Broadcast failure creation event."""
        await self.broadcast.broadcast({
            "type": "failure_created",
            "failure": failure,
        })

    async def _broadcast_failure_update(self, failure: Failure) -> None:
        """Broadcast failure update event."""
        await self.broadcast.broadcast({
            "type": "failure_update",
            "failure": failure,
        })

    async def _broadcast_task_update(self, task: TaskExecution) -> None:
        """Broadcast task update event."""
        await self.broadcast.broadcast({
            "type": "task_update",
            "task": task,
        })

    async def _broadcast_pipeline_complete(self, failure_id: str) -> None:
        """Broadcast pipeline completion event."""
        await self.broadcast.broadcast({
            "type": "pipeline_complete",
            "failure_id": failure_id,
        })
