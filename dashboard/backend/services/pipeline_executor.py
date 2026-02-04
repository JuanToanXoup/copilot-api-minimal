"""Pipeline executor service - runs workflows against failures."""

import asyncio
import json
import re
import uuid
from datetime import datetime
from pathlib import Path
from typing import TYPE_CHECKING, Any, Optional

import httpx

import yaml

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
        self.active_project_path: Optional[str] = None  # Project path for loading prompts
        self._execution_queue: asyncio.Queue = asyncio.Queue()
        self._running = False

    # ==================== Pipeline Run Directory ====================

    def _get_run_directory(self, failure_id: str, project_path: str | None = None) -> Path:
        """Get the directory for storing pipeline run state files."""
        paths = get_project_paths(project_path)
        base_dir = paths["flows_dir"].parent  # .citi-agent directory
        run_dir = base_dir / "pipeline-runs" / failure_id
        run_dir.mkdir(parents=True, exist_ok=True)
        return run_dir

    def _save_to_run(
        self,
        failure_id: str,
        filename: str,
        data: Any,
        project_path: str | None = None,
    ) -> Path:
        """Save data to a file in the pipeline run directory."""
        run_dir = self._get_run_directory(failure_id, project_path)
        file_path = run_dir / filename

        # Ensure data is JSON serializable
        if isinstance(data, str):
            content = data
        else:
            content = json.dumps(data, indent=2, default=str)

        file_path.write_text(content)
        return file_path

    def _list_run_files(self, failure_id: str, project_path: str | None = None) -> list[str]:
        """List all files in the pipeline run directory."""
        run_dir = self._get_run_directory(failure_id, project_path)
        return sorted([f.name for f in run_dir.glob("*.json")])

    def _get_run_context_prompt(self, failure_id: str, project_path: str | None = None) -> str:
        """Generate a prompt section describing the available run state files."""
        run_dir = self._get_run_directory(failure_id, project_path)
        files = self._list_run_files(failure_id, project_path)

        if not files:
            return ""

        lines = [
            f"\n## Pipeline State Directory",
            f"Previous outputs are saved at: {run_dir}",
            f"",
            f"Available files:",
        ]
        for f in files:
            lines.append(f"  - {f}")

        lines.append("")
        lines.append("Read these files to understand context from previous steps.")
        lines.append("")

        return "\n".join(lines)

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

    def set_active_workflow(self, workflow_id: str, project_path: str | None = None) -> None:
        """Set the active workflow for processing failures."""
        self.active_workflow_id = workflow_id
        if project_path:
            self.active_project_path = project_path

    def get_active_workflow(self) -> Optional[str]:
        """Get the current active workflow ID."""
        return self.active_workflow_id

    def load_workflow(self, workflow_id: str, project_path: str | None = None) -> Optional[dict]:
        """Load a workflow definition from storage.

        Searches project-specific location first, then falls back to global.
        Matches by filename or by name field inside the JSON.
        """
        def search_in_dir(flows_dir: Path) -> Optional[tuple[Path, dict]]:
            """Search for workflow in a directory. Returns (path, data) if found."""
            if not flows_dir.exists():
                return None

            # First try exact filename match
            flow_path = flows_dir / f"{workflow_id}.json"
            if flow_path.exists():
                try:
                    with open(flow_path) as f:
                        return (flow_path, json.load(f))
                except Exception:
                    pass

            # Search all JSON files by filename stem or by name field inside
            for file in flows_dir.rglob("*.json"):
                # Check filename match
                if file.stem == workflow_id:
                    try:
                        with open(file) as f:
                            return (file, json.load(f))
                    except Exception:
                        continue

                # Check name field inside JSON
                try:
                    with open(file) as f:
                        data = json.load(f)
                        if data.get("name") == workflow_id:
                            return (file, data)
                except Exception:
                    continue

            return None

        # Try project-specific location first
        if project_path:
            project_paths = get_project_paths(project_path)
            result = search_in_dir(project_paths["flows_dir"])
            if result:
                return result[1]  # Return the data

        # Fall back to global location
        global_paths = get_project_paths(None)
        result = search_in_dir(global_paths["flows_dir"])
        if result:
            return result[1]  # Return the data

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

        # Determine project path for this run
        project_path = self.active_project_path
        if not project_path:
            # Try to get from first connected agent
            registry = self.agent_manager.read_registry()
            for entry in registry.values():
                if entry.get("projectPath"):
                    project_path = entry["projectPath"]
                    break

        # Save initial failure data to run directory
        initial_data = {
            "test_file": failure["test_file"],
            "test_name": failure["test_name"],
            "error_message": failure["error_message"],
            "stack_trace": failure.get("stack_trace", ""),
            "expected": failure.get("expected", ""),
            "actual": failure.get("actual", ""),
            **failure.get("context", {}),
        }
        self._save_to_run(failure_id, "00-failure-input.json", initial_data, project_path)

        # Store run directory path in pipeline state
        run_dir = self._get_run_directory(failure_id, project_path)
        pipeline["run_directory"] = str(run_dir)
        pipeline["project_path"] = project_path

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

                    # Save output to file in run directory
                    # Format: {step_number:02d}-{sanitized_label}.json
                    node_label = task["node_label"]
                    safe_label = re.sub(r'[^\w\s-]', '', node_label).strip().lower()
                    safe_label = re.sub(r'[-\s]+', '-', safe_label)[:40]
                    step_num = i + 1  # 1-indexed step number
                    filename = f"{step_num:02d}-{safe_label}.json"

                    # Get output name from template if available
                    output_name = None
                    prompt_template_id = node.get("data", {}).get("promptTemplateId")
                    if prompt_template_id:
                        template = self._load_prompt_template(prompt_template_id, project_path)
                        if template:
                            output_extraction = template.get("outputExtraction", {})
                            output_name = output_extraction.get("outputName")
                            if output_name:
                                context[output_name] = result.get("response", result)

                    # Save to file with metadata
                    output_data = {
                        "step": step_num,
                        "node_id": node_id,
                        "node_label": node_label,
                        "output_name": output_name,
                        "timestamp": datetime.now().isoformat(),
                        "response": result.get("response", result),
                    }
                    self._save_to_run(failure_id, filename, output_data, project_path)

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

        # Get project path from pipeline state
        failure_id = task["failure_id"]
        pipeline = self.pipelines.get(failure_id, {})
        project_path = pipeline.get("project_path") or self.active_project_path

        # If no agent specified, get an agent that matches the project
        if not agent_id:
            conn = None
            # First, try to get an agent for the specific project
            if project_path:
                conn = self.agent_manager.get_agent_for_project(project_path)
            # Fall back to any connected agent
            if not conn:
                conn = self.agent_manager.get_connected_agent()

            if conn:
                agent_id = conn.instance_id
            else:
                task["status"] = "failed"
                task["error"] = f"No agent available for project: {project_path}"
                task["completed_at"] = datetime.now().isoformat()
                await self._broadcast_task_update(task)
                raise ValueError(f"No agent available for project: {project_path}")

        # Get agent connection
        conn = self.agent_manager.get_connection(agent_id)
        if not conn or not self.agent_manager.agents.get(agent_id, {}).get("connected"):
            task["status"] = "failed"
            task["error"] = "Agent not connected"
            task["completed_at"] = datetime.now().isoformat()
            await self._broadcast_task_update(task)
            raise ValueError(f"Agent {agent_id} not connected")

        # Start a fresh agent session for this prompt (no conversation history)
        # Add delay to allow UI to fully render previous response before clearing
        await asyncio.sleep(1.5)
        await self._start_new_agent_session(conn)

        # Get the declared inputs for this node (what specific data it needs)
        declared_inputs = data.get("inputs", [])  # e.g., ["error_message", "test_file"]

        # Build scoped context with only the declared inputs
        scoped_context = self._build_scoped_context(declared_inputs, context)

        # Build prompt from template or node data
        prompt = ""
        node_label = data.get("label", "")
        node_description = data.get("description", "")

        # Get the run directory context (lists available state files)
        run_context = self._get_run_context_prompt(failure_id, project_path)

        if prompt_template_id:
            # Load the actual prompt template
            template = self._load_prompt_template(prompt_template_id, project_path)
            if template and template.get("template"):
                # Use the loaded template with variable substitution
                prompt = self._build_prompt_with_template(
                    template["template"],
                    context,
                    template.get("outputExtraction"),
                )
            else:
                # Fallback if template not found
                prompt = self._build_prompt_from_template(
                    node_label, node_description, scoped_context, declared_inputs
                )
        elif data.get("prompt"):
            prompt = data.get("prompt", "")
            # Substitute variables in the raw prompt
            prompt = self._substitute_variables(prompt, context)
        else:
            # Build a focused prompt with only relevant context
            prompt = self._build_prompt_from_template(
                node_label, node_description, scoped_context, declared_inputs
            )

        # Append run directory context to the prompt
        # This tells the agent where to find previous outputs
        if run_context:
            prompt = prompt + "\n" + run_context

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

    async def _start_new_agent_session(self, conn) -> bool:
        """Start a fresh agent chat session (clears conversation history).

        Returns True if session was successfully reset, False otherwise.
        """
        try:
            result = await conn.send_command("newAgentSession", timeout=5.0)

            if result.get("status") == "success":
                print(f"New agent session started for {conn.instance_id}")
                return True
            else:
                error = result.get("error") or result.get("message", "Unknown error")
                print(f"Warning: Failed to start new agent session: {error}")
                return False

        except Exception as e:
            print(f"Warning: Exception starting new agent session: {e}")
            return False

    def _build_scoped_context(
        self,
        declared_inputs: list[str],
        context: dict,
    ) -> dict:
        """Build a context dict with only the declared inputs."""
        if not declared_inputs:
            # If no inputs declared, include basic failure info
            failure = context.get("failure", {})
            return {
                "error_message": failure.get("error_message", ""),
                "test_file": failure.get("test_file", ""),
                "test_name": failure.get("test_name", ""),
            }

        scoped = {}
        failure = context.get("failure", {})

        for input_name in declared_inputs:
            # Check failure data first
            if input_name in failure:
                scoped[input_name] = failure[input_name]
            # Check node outputs (from previous nodes)
            elif input_name in context:
                val = context[input_name]
                if isinstance(val, dict) and "response" in val:
                    scoped[input_name] = val["response"]
                else:
                    scoped[input_name] = val
            # Check for dot notation (e.g., "node_id.output_name")
            elif "." in input_name:
                node_id, output_name = input_name.split(".", 1)
                if node_id in context and isinstance(context[node_id], dict):
                    scoped[input_name] = context[node_id].get(output_name, "")

        return scoped

    def _load_prompt_template(self, prompt_id: str, project_path: str | None = None) -> Optional[dict]:
        """Load a prompt template by ID from the prompts directory.

        Searches project-local prompts first, then falls back to global.
        """
        def parse_prompt_file(file_path: Path) -> Optional[dict]:
            """Parse a markdown prompt file with YAML frontmatter."""
            try:
                content = file_path.read_text()
                match = re.match(r'^---\s*\n(.*?)\n---\s*\n(.*)$', content, re.DOTALL)
                if not match:
                    return None
                frontmatter = yaml.safe_load(match.group(1))
                template = match.group(2).strip()
                if frontmatter and isinstance(frontmatter, dict):
                    return {
                        'id': frontmatter.get('id', file_path.stem),
                        'name': frontmatter.get('name', ''),
                        'description': frontmatter.get('description', ''),
                        'template': template,
                        'outputExtraction': frontmatter.get('outputExtraction', {}),
                    }
            except Exception:
                pass
            return None

        def search_in_dir(prompts_dir: Path) -> Optional[dict]:
            """Search for prompt in a directory."""
            if not prompts_dir.exists():
                return None
            for file in prompts_dir.rglob("*.md"):
                prompt = parse_prompt_file(file)
                if prompt and (prompt.get('id') == prompt_id or file.stem == prompt_id):
                    return prompt
            return None

        # Try project-local first
        if project_path:
            local_paths = get_project_paths(project_path)
            result = search_in_dir(local_paths["prompts_dir"])
            if result:
                return result

        # Search all known projects from registry
        registry = self.agent_manager.read_registry()
        for agent_entry in registry.values():
            agent_project = agent_entry.get("projectPath")
            if agent_project and agent_project != project_path:
                agent_paths = get_project_paths(agent_project)
                result = search_in_dir(agent_paths["prompts_dir"])
                if result:
                    return result

        # Fall back to global
        global_paths = get_project_paths(None)
        return search_in_dir(global_paths["prompts_dir"])

    def _build_prompt_from_template(
        self,
        label: str,
        description: str,
        scoped_context: dict,
        declared_inputs: list[str],
    ) -> str:
        """Build a fallback prompt when no template is available."""
        parts = [f"## Task: {label}"]

        if description:
            parts.append(f"\n{description}")

        if scoped_context:
            parts.append("\n## Input Data:")
            for key, value in scoped_context.items():
                if isinstance(value, str) and len(value) > 500:
                    value = value[:500] + "..."
                parts.append(f"\n### {key}:\n{value}")

        parts.append("\n## Instructions:")
        parts.append("Analyze the input data and provide your findings.")
        parts.append("Be concise and focused on the specific task.")

        return "\n".join(parts)

    def _build_prompt_with_template(
        self,
        template_content: str,
        context: dict,
        output_extraction: dict | None = None,
    ) -> str:
        """Build a prompt using a loaded template with variable substitution."""
        # Substitute variables in the template
        prompt = self._substitute_variables(template_content, context)

        # Add output format reminder if specified
        if output_extraction:
            mode = output_extraction.get('mode', 'full')
            output_name = output_extraction.get('outputName', 'output')
            if mode == 'json':
                prompt += f"\n\n---\nIMPORTANT: Return your response as valid JSON only. The output will be stored as '{output_name}'."

        return prompt

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
