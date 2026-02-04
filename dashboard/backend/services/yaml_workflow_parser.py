"""YAML Workflow Parser and Converter.

Converts YAML workflow definitions to React Flow workflow JSON.
"""

from dataclasses import dataclass, field
from typing import Any
import yaml


class YAMLWorkflowError(Exception):
    """Error parsing or converting YAML workflow."""

    def __init__(self, message: str, path: str | None = None):
        self.message = message
        self.path = path
        super().__init__(f"{message}" + (f" at {path}" if path else ""))


@dataclass
class ConversionContext:
    """Tracks state during conversion."""

    node_counter: int = 0
    edge_counter: int = 0
    nodes: list = field(default_factory=list)
    edges: list = field(default_factory=list)
    agent_map: dict = field(default_factory=dict)  # agent_name -> [node_ids]
    pending_connections: list = field(default_factory=list)  # Branch endpoints needing connection


class YAMLWorkflowConverter:
    """Converts YAML workflow definitions to React Flow JSON."""

    def convert(self, yaml_content: str) -> dict:
        """Convert YAML workflow to React Flow JSON.

        Args:
            yaml_content: YAML string containing workflow definition

        Returns:
            Dict with nodes, edges, and metadata
        """
        try:
            data = yaml.safe_load(yaml_content)
        except yaml.YAMLError as e:
            raise YAMLWorkflowError(f"Invalid YAML: {e}")

        if not data:
            raise YAMLWorkflowError("Empty YAML document")

        # Support both root-level workflow key and direct structure
        workflow = data.get("workflow", data)

        name = workflow.get("name", "Untitled Workflow")
        description = workflow.get("description")
        agents = workflow.get("agents", [])
        inputs = workflow.get("inputs", [])
        steps = workflow.get("steps", [])

        if not steps:
            raise YAMLWorkflowError("Workflow has no steps")

        # Initialize conversion context
        ctx = ConversionContext()

        # Build agent color map
        agent_colors = {a["name"]: a.get("color") for a in agents}

        # Add start node
        start_id = self._add_node(ctx, "workflowStart", "Start", {
            "label": "Start",
            "status": "idle"
        })

        # Process all steps
        last_id = start_id
        for i, step in enumerate(steps):
            last_id = self._process_step(ctx, step, last_id, f"steps[{i}]")

        # Add end node and connect
        end_id = self._add_node(ctx, "output", "End", {
            "label": "End",
            "results": [],
            "status": "idle"
        })
        self._add_edge(ctx, last_id, end_id)

        # Connect any remaining pending connections to end
        for pending_id in ctx.pending_connections:
            self._add_edge(ctx, pending_id, end_id)
        ctx.pending_connections = []

        # Auto-layout
        self._calculate_positions(ctx)

        # Build agent mappings
        agent_mappings = []
        for agent_name, node_ids in ctx.agent_map.items():
            agent_mappings.append({
                "logicalName": agent_name,
                "swimlaneColor": agent_colors.get(agent_name),
                "nodeIds": node_ids,
            })

        return {
            "name": name,
            "description": description,
            "nodes": ctx.nodes,
            "edges": ctx.edges,
            "agentMappings": agent_mappings,
            "inputVariables": inputs,
        }

    def _process_step(self, ctx: ConversionContext, step: dict, prev_id: str, path: str) -> str:
        """Process a single step and return the last node ID."""

        # Determine step type and dispatch
        if "prompt" in step:
            return self._process_prompt(ctx, step, prev_id, path)
        elif "http" in step:
            return self._process_http(ctx, step, prev_id, path)
        elif "if" in step:
            return self._process_condition(ctx, step, prev_id, path)
        elif "parallel" in step:
            return self._process_parallel(ctx, step, prev_id, path)
        elif "aggregate" in step:
            return self._process_aggregate(ctx, step, prev_id, path)
        elif "loop" in step:
            return self._process_loop(ctx, step, prev_id, path)
        elif "router" in step:
            return self._process_router(ctx, step, prev_id, path)
        else:
            raise YAMLWorkflowError(f"Unknown step type: {list(step.keys())}", path)

    def _process_prompt(self, ctx: ConversionContext, step: dict, prev_id: str, path: str) -> str:
        """Process a prompt step."""
        label = step["prompt"]
        template = step.get("template")
        input_var = step.get("input", "{{upstream}}")
        agent = step.get("agent")
        output = step.get("output")

        # Parse variable bindings from input
        bindings = self._parse_variable_bindings(input_var)

        node_id = self._add_node(ctx, "promptBlock", label, {
            "label": label,
            "agentId": None,
            "promptTemplateId": template,
            "variableBindings": bindings,
            "status": "idle",
        })

        # Track agent mapping
        if agent:
            if agent not in ctx.agent_map:
                ctx.agent_map[agent] = []
            ctx.agent_map[agent].append(node_id)

        # Connect from previous
        self._add_edge(ctx, prev_id, node_id)

        # Connect pending branch endpoints
        self._connect_pending(ctx, node_id)

        return node_id

    def _process_http(self, ctx: ConversionContext, step: dict, prev_id: str, path: str) -> str:
        """Process an HTTP request step."""
        label = step["http"]
        method = step.get("method", "GET").upper()
        url = step.get("url", "")
        headers = step.get("headers", {})
        body = step.get("body")

        node_id = self._add_node(ctx, "httpRequest", label, {
            "label": label,
            "method": method,
            "url": url,
            "headers": headers,
            "body": body,
            "status": "idle",
        })

        self._add_edge(ctx, prev_id, node_id)
        self._connect_pending(ctx, node_id)

        return node_id

    def _process_condition(self, ctx: ConversionContext, step: dict, prev_id: str, path: str) -> str:
        """Process an if/elif/else condition."""
        condition_expr = step["if"]
        variable, operator, value = self._parse_condition_expr(condition_expr)

        node_id = self._add_node(ctx, "condition", condition_expr, {
            "label": f"If {self._simplify_condition_label(condition_expr)}",
            "variable": variable,
            "operator": operator,
            "value": value,
            "status": "idle",
        })

        self._add_edge(ctx, prev_id, node_id)
        self._connect_pending(ctx, node_id)

        branch_endpoints = []

        # Process 'then' branch (true)
        then_steps = step.get("then", [])
        if then_steps:
            last_then = node_id
            for i, s in enumerate(then_steps):
                if i == 0:
                    # First edge gets 'true' handle
                    next_id = self._process_step(ctx, s, last_then, f"{path}.then[{i}]")
                    # Mark the edge as true branch
                    for e in ctx.edges:
                        if e["source"] == node_id and e["target"] == next_id:
                            e["sourceHandle"] = "true"
                            break
                    last_then = next_id
                else:
                    last_then = self._process_step(ctx, s, last_then, f"{path}.then[{i}]")
            branch_endpoints.append(last_then)

        # Process 'elif' branches (converted to nested conditions in false branch)
        elif_conditions = []
        i = 0
        while f"elif" in step or (i == 0 and "elif" in step):
            # Handle multiple elif by looking for elif, elif_1, elif_2, etc. or repeated elif keys
            # Since YAML doesn't support duplicate keys, we handle elif as a special case
            break  # For now, handle elif through the step structure

        # Check for elif in the step (as a list pattern)
        if "elif" in step:
            # elif creates a nested condition in the false branch
            elif_expr = step["elif"]
            elif_then = step.get("then", [])  # This would be ambiguous, need different structure

        # Process 'else' branch (false)
        else_steps = step.get("else", [])
        if else_steps:
            last_else = node_id
            for i, s in enumerate(else_steps):
                if i == 0:
                    next_id = self._process_step(ctx, s, last_else, f"{path}.else[{i}]")
                    for e in ctx.edges:
                        if e["source"] == node_id and e["target"] == next_id:
                            e["sourceHandle"] = "false"
                            break
                    last_else = next_id
                else:
                    last_else = self._process_step(ctx, s, last_else, f"{path}.else[{i}]")
            branch_endpoints.append(last_else)

        # If no else branch, condition node itself is an endpoint
        if not else_steps:
            branch_endpoints.append(node_id)

        # Store additional endpoints for later connection
        if len(branch_endpoints) > 1:
            ctx.pending_connections.extend(branch_endpoints[1:])

        return branch_endpoints[0] if branch_endpoints else node_id

    def _process_parallel(self, ctx: ConversionContext, step: dict, prev_id: str, path: str) -> str:
        """Process parallel execution (fork)."""
        branches = step.get("parallel", [])
        branch_endpoints = []

        for i, branch_def in enumerate(branches):
            branch_steps = branch_def.get("branch", [])
            if not branch_steps:
                continue

            # Process first step of branch
            last_branch = prev_id
            for j, s in enumerate(branch_steps):
                last_branch = self._process_step(ctx, s, last_branch, f"{path}.parallel[{i}].branch[{j}]")

            branch_endpoints.append(last_branch)

        # Store all but first endpoint for connection to next node
        if len(branch_endpoints) > 1:
            ctx.pending_connections.extend(branch_endpoints[1:])

        return branch_endpoints[0] if branch_endpoints else prev_id

    def _process_aggregate(self, ctx: ConversionContext, step: dict, prev_id: str, path: str) -> str:
        """Process an aggregator node."""
        label = step["aggregate"]
        strategy = step.get("strategy", "merge")

        node_id = self._add_node(ctx, "aggregator", label, {
            "label": label,
            "mode": strategy,
            "strategy": strategy,
            "status": "idle",
        })

        self._add_edge(ctx, prev_id, node_id)
        self._connect_pending(ctx, node_id)

        return node_id

    def _process_loop(self, ctx: ConversionContext, step: dict, prev_id: str, path: str) -> str:
        """Process a loop (evaluator pattern)."""
        loop_def = step.get("loop", step)
        max_iterations = loop_def.get("max", 3)
        until_condition = loop_def.get("until", "true")
        loop_steps = loop_def.get("steps", [])

        # Create evaluator node
        node_id = self._add_node(ctx, "evaluator", "Loop", {
            "label": f"Loop (max {max_iterations})",
            "maxIterations": max_iterations,
            "iteration": 0,
            "condition": until_condition,
            "status": "idle",
        })

        self._add_edge(ctx, prev_id, node_id)
        self._connect_pending(ctx, node_id)

        # Process loop body
        if loop_steps:
            last_loop = node_id
            for i, s in enumerate(loop_steps):
                last_loop = self._process_step(ctx, s, last_loop, f"{path}.loop.steps[{i}]")

            # Connect last step back to evaluator (rejected/retry path)
            self._add_edge(ctx, last_loop, node_id, target_handle="rejected")

        return node_id

    def _process_router(self, ctx: ConversionContext, step: dict, prev_id: str, path: str) -> str:
        """Process a router node."""
        label = step["router"]
        variable = step.get("variable", "")
        routes = step.get("routes", {})

        route_names = list(routes.keys())

        node_id = self._add_node(ctx, "router", label, {
            "label": label,
            "variable": variable,
            "routes": route_names,
            "status": "idle",
        })

        self._add_edge(ctx, prev_id, node_id)
        self._connect_pending(ctx, node_id)

        branch_endpoints = []

        # Process each route
        for i, (route_name, route_steps) in enumerate(routes.items()):
            if not route_steps:
                continue

            last_route = node_id
            for j, s in enumerate(route_steps):
                if j == 0:
                    next_id = self._process_step(ctx, s, last_route, f"{path}.routes.{route_name}[{j}]")
                    # Set route handle
                    for e in ctx.edges:
                        if e["source"] == node_id and e["target"] == next_id:
                            e["sourceHandle"] = f"route-{i}"
                            break
                    last_route = next_id
                else:
                    last_route = self._process_step(ctx, s, last_route, f"{path}.routes.{route_name}[{j}]")

            branch_endpoints.append(last_route)

        # Store additional endpoints
        if len(branch_endpoints) > 1:
            ctx.pending_connections.extend(branch_endpoints[1:])

        return branch_endpoints[0] if branch_endpoints else node_id

    def _add_node(self, ctx: ConversionContext, node_type: str, label: str, data: dict) -> str:
        """Add a node and return its ID."""
        ctx.node_counter += 1
        safe_label = self._sanitize_id(label)
        node_id = f"{node_type}-{safe_label}-{ctx.node_counter}"

        ctx.nodes.append({
            "id": node_id,
            "type": node_type,
            "position": {"x": 0, "y": 0},
            "data": data,
        })

        return node_id

    def _add_edge(self, ctx: ConversionContext, source: str, target: str,
                  source_handle: str | None = None, target_handle: str | None = None) -> str:
        """Add an edge and return its ID."""
        ctx.edge_counter += 1
        edge_id = f"e{ctx.edge_counter}"

        edge = {
            "id": edge_id,
            "source": source,
            "target": target,
            "animated": True,
        }

        if source_handle:
            edge["sourceHandle"] = source_handle
        if target_handle:
            edge["targetHandle"] = target_handle

        ctx.edges.append(edge)
        return edge_id

    def _connect_pending(self, ctx: ConversionContext, target_id: str):
        """Connect all pending branch endpoints to a target node."""
        for pending_id in ctx.pending_connections:
            self._add_edge(ctx, pending_id, target_id)
        ctx.pending_connections = []

    def _sanitize_id(self, text: str) -> str:
        """Sanitize text for use in node ID."""
        import re
        safe = re.sub(r'[^\w\s-]', '', text).strip().lower()
        safe = re.sub(r'[-\s]+', '-', safe)
        return safe[:20] or "node"

    def _parse_variable_bindings(self, input_str: str) -> list:
        """Parse variable references from input string."""
        import re
        bindings = []
        matches = re.findall(r'\{\{(\w+(?:\.\w+)*)\}\}', input_str)
        for match in matches:
            bindings.append({
                "variableName": match.split('.')[0],
                "source": "upstream"
            })
        return bindings if bindings else [{"variableName": "input", "source": "upstream"}]

    def _parse_condition_expr(self, expr: str) -> tuple[str, str, str]:
        """Parse condition expression into variable, operator, value."""
        import re

        # Try to match patterns like: {{var}} == 'value' or {{var}} == true
        match = re.match(r"\{\{(\w+(?:\.\w+)*)\}\}\s*(==|!=|>|<|>=|<=)\s*['\"]?([^'\"]+)['\"]?", expr)
        if match:
            return match.group(1), match.group(2), match.group(3)

        # Fallback
        return expr, "==", "true"

    def _simplify_condition_label(self, expr: str) -> str:
        """Create a short label from condition expression."""
        import re
        # Extract just the variable name
        match = re.search(r'\{\{(\w+)', expr)
        if match:
            return match.group(1)
        return expr[:20]

    def _calculate_positions(self, ctx: ConversionContext):
        """Calculate node positions using hierarchical layout."""
        if not ctx.nodes:
            return

        # Build adjacency for BFS
        adjacency = {n["id"]: [] for n in ctx.nodes}
        for e in ctx.edges:
            if e["source"] in adjacency:
                adjacency[e["source"]].append(e["target"])

        # BFS to assign levels
        levels = {}
        start_nodes = [n["id"] for n in ctx.nodes if n["type"] == "workflowStart"]
        if not start_nodes:
            start_nodes = [ctx.nodes[0]["id"]]

        queue = [(start_nodes[0], 0)]
        visited = set()

        while queue:
            node_id, level = queue.pop(0)
            if node_id in visited:
                continue
            visited.add(node_id)
            levels[node_id] = level

            for target in adjacency.get(node_id, []):
                if target not in visited:
                    queue.append((target, level + 1))

        # Assign any unvisited nodes
        for n in ctx.nodes:
            if n["id"] not in levels:
                levels[n["id"]] = 0

        # Group by level
        level_nodes = {}
        for node_id, level in levels.items():
            if level not in level_nodes:
                level_nodes[level] = []
            level_nodes[level].append(node_id)

        # Position nodes
        x_spacing = 400
        y_spacing = 150

        for level, node_ids in level_nodes.items():
            x = 50 + level * x_spacing
            total_height = (len(node_ids) - 1) * y_spacing
            start_y = 200 - total_height / 2

            for i, node_id in enumerate(node_ids):
                y = start_y + i * y_spacing
                for n in ctx.nodes:
                    if n["id"] == node_id:
                        n["position"] = {"x": x, "y": y}
                        break
