"""PlantUML to Workflow JSON converter.

Parses PlantUML activity diagrams with annotations and converts them
into React Flow workflow JSON compatible with the dashboard.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any


class PlantUMLParseError(Exception):
    """Error during PlantUML parsing."""

    def __init__(self, message: str, line: int | None = None, context: str | None = None):
        super().__init__(message)
        self.line = line
        self.context = context


@dataclass
class ParsedAnnotation:
    """Annotation data from a note block."""

    type: str  # prompt, http, router, aggregator, input
    fields: dict[str, Any] = field(default_factory=dict)


@dataclass
class ParsedActivity:
    """A single activity in the diagram."""

    label: str
    swimlane: str | None = None
    annotation: ParsedAnnotation | None = None


@dataclass
class ParsedCondition:
    """An if/else condition block."""

    expression: str
    variable: str
    operator: str
    value: str
    true_branch: list = field(default_factory=list)
    false_branch: list = field(default_factory=list)


@dataclass
class ParsedFork:
    """A fork/fork again/end fork parallel block."""

    branches: list[list] = field(default_factory=list)


@dataclass
class ParsedLoop:
    """A repeat/repeat while loop block."""

    body: list = field(default_factory=list)
    condition: str = ""


class PlantUMLParser:
    """Parse PlantUML activity diagram text into intermediate representation."""

    # Regex patterns
    TITLE_PATTERN = re.compile(r"^title\s+(.+)$", re.MULTILINE)
    SWIMLANE_PATTERN = re.compile(r"^\|(?:#([A-Za-z]+))?\|?([^|]+)\|$", re.MULTILINE)
    ACTIVITY_PATTERN = re.compile(r"^:([^;]+);$", re.MULTILINE)
    NOTE_START_PATTERN = re.compile(r"^note\s+(right|left)$", re.MULTILINE)
    NOTE_END_PATTERN = re.compile(r"^end\s+note$", re.MULTILINE)
    IF_PATTERN = re.compile(r"^if\s*\((.+)\?\)\s*then\s*\(([^)]*)\)$", re.MULTILINE)
    ELSE_PATTERN = re.compile(r"^else\s*\(([^)]*)\)$", re.MULTILINE)
    ELSEIF_PATTERN = re.compile(r"^else\s*if\s*\(([^)]+)\)\s*then(?:\s*\(([^)]*)\))?$", re.MULTILINE)
    ENDIF_PATTERN = re.compile(r"^endif$", re.MULTILINE)
    FORK_PATTERN = re.compile(r"^fork$", re.MULTILINE)
    FORK_AGAIN_PATTERN = re.compile(r"^fork\s+again$", re.MULTILINE)
    END_FORK_PATTERN = re.compile(r"^end\s+fork$", re.MULTILINE)
    SPLIT_PATTERN = re.compile(r"^split$", re.MULTILINE)
    SPLIT_AGAIN_PATTERN = re.compile(r"^split\s+again$", re.MULTILINE)
    END_SPLIT_PATTERN = re.compile(r"^end\s+split$", re.MULTILINE)
    REPEAT_PATTERN = re.compile(r"^repeat$", re.MULTILINE)
    REPEAT_WHILE_PATTERN = re.compile(r"^repeat\s+while\s*\((.+)\?\)\s*is\s*\(([^)]*)\)$", re.MULTILINE)
    CONDITION_EXPR_PATTERN = re.compile(r"(\$?\w+(?:\.\w+)?)\s*(==|!=|>|<|>=|<=|contains|matches)\s*(.+)")

    def parse(self, text: str) -> dict:
        """Parse PlantUML text into intermediate representation.

        Returns:
            {
                'title': str,
                'description': str | None,
                'swimlanes': [{'name': str, 'color': str | None}],
                'body': [ParsedActivity | ParsedCondition | ParsedFork | ParsedLoop],
                'input_vars': [{'name': str, 'type': str, 'required': bool}]
            }
        """
        # Clean text
        lines = self._preprocess(text)

        result = {
            "title": "Untitled Workflow",
            "description": None,
            "swimlanes": [],
            "body": [],
            "input_vars": [],
        }

        # Extract title
        title_match = self.TITLE_PATTERN.search(text)
        if title_match:
            result["title"] = title_match.group(1).strip()

        # Extract swimlanes
        swimlanes = {}
        for match in self.SWIMLANE_PATTERN.finditer(text):
            color = match.group(1)
            name = match.group(2).strip()
            if name not in swimlanes:
                swimlanes[name] = {"name": name, "color": color}
        result["swimlanes"] = list(swimlanes.values())

        # Parse body
        result["body"], result["input_vars"] = self._parse_body(lines)

        return result

    def _preprocess(self, text: str) -> list[str]:
        """Preprocess text into cleaned lines.

        Note: We strip leading whitespace for most lines but preserve
        relative indentation within note blocks for YAML-style parsing.
        """
        lines = []
        in_diagram = False
        in_note = False

        for line in text.split("\n"):
            stripped = line.strip()

            # Skip empty lines
            if not stripped:
                continue

            # Track diagram boundaries
            if stripped.startswith("@startuml"):
                in_diagram = True
                continue
            if stripped == "@enduml":
                in_diagram = False
                continue

            if in_diagram:
                # Track note blocks to preserve indentation
                if stripped.startswith("note "):
                    in_note = True
                    lines.append(stripped)
                elif stripped == "end note":
                    in_note = False
                    lines.append(stripped)
                elif in_note:
                    # Preserve the line with minimal normalization
                    # Remove common leading whitespace but keep relative indent
                    lines.append(line.strip())  # For now, we'll handle this differently
                else:
                    lines.append(stripped)

        return lines

    def _parse_body(self, lines: list[str]) -> tuple[list, list]:
        """Parse the body of the diagram."""
        body = []
        input_vars = []
        i = 0
        current_swimlane = None

        while i < len(lines):
            line = lines[i]

            # Skip title (already extracted)
            if line.startswith("title "):
                i += 1
                continue

            # Swimlane declaration
            swimlane_match = self.SWIMLANE_PATTERN.match(line)
            if swimlane_match:
                current_swimlane = swimlane_match.group(2).strip()
                i += 1
                continue

            # Inline swimlane change (|SwimlaneNamme|)
            if line.startswith("|") and line.endswith("|"):
                parts = line.strip("|").split("|")
                if parts:
                    # Handle color prefix like |#LightBlue|Name|
                    name = parts[-1] if len(parts) > 1 else parts[0]
                    if name.startswith("#"):
                        name = parts[-1] if len(parts) > 1 else name.lstrip("#")
                    current_swimlane = name.strip()
                i += 1
                continue

            # Start node
            if line == "start":
                # Check for input annotation
                if i + 1 < len(lines) and lines[i + 1].startswith("note"):
                    annotation, note_end = self._parse_note(lines, i + 1)
                    if annotation and annotation.type == "input":
                        input_vars = annotation.fields.get("variables", [])
                    i = note_end + 1
                else:
                    i += 1
                body.append(ParsedActivity(label="Start", swimlane=current_swimlane, annotation=ParsedAnnotation(type="start")))
                continue

            # Stop node
            if line == "stop":
                body.append(ParsedActivity(label="End", swimlane=current_swimlane, annotation=ParsedAnnotation(type="stop")))
                i += 1
                continue

            # Activity
            activity_match = self.ACTIVITY_PATTERN.match(line)
            if activity_match:
                label = activity_match.group(1).strip()
                annotation = None

                # Check for note
                if i + 1 < len(lines) and lines[i + 1].startswith("note"):
                    annotation, note_end = self._parse_note(lines, i + 1)
                    i = note_end + 1
                else:
                    i += 1

                body.append(ParsedActivity(label=label, swimlane=current_swimlane, annotation=annotation))
                continue

            # If/else condition
            if_match = self.IF_PATTERN.match(line)
            if if_match:
                condition, end_idx = self._parse_condition(lines, i, current_swimlane)
                body.append(condition)
                i = end_idx + 1
                continue

            # Fork
            if self.FORK_PATTERN.match(line):
                fork, end_idx = self._parse_fork(lines, i, current_swimlane)
                body.append(fork)
                i = end_idx + 1
                continue

            # Split (treat same as fork)
            if self.SPLIT_PATTERN.match(line):
                fork, end_idx = self._parse_split(lines, i, current_swimlane)
                body.append(fork)
                i = end_idx + 1
                continue

            # Repeat loop
            if self.REPEAT_PATTERN.match(line):
                loop, end_idx = self._parse_repeat(lines, i, current_swimlane)
                body.append(loop)
                i = end_idx + 1
                continue

            # Skip unrecognized lines
            i += 1

        return body, input_vars

    def _parse_note(self, lines: list[str], start_idx: int) -> tuple[ParsedAnnotation | None, int]:
        """Parse a note block and return annotation and end index."""
        i = start_idx + 1  # Skip 'note right/left'
        note_content = []

        while i < len(lines):
            if self.NOTE_END_PATTERN.match(lines[i]):
                break
            note_content.append(lines[i])
            i += 1

        if not note_content:
            return None, i

        # Parse annotation content
        return self._parse_annotation(note_content), i

    def _parse_annotation(self, content: list[str]) -> ParsedAnnotation | None:
        """Parse note content into annotation."""
        full_content = "\n".join(content)

        # Detect annotation type
        annotation_type = None
        if "<<prompt>>" in full_content:
            annotation_type = "prompt"
        elif "<<http>>" in full_content:
            annotation_type = "http"
        elif "<<router>>" in full_content:
            annotation_type = "router"
        elif "<<aggregator>>" in full_content:
            annotation_type = "aggregator"
        elif "<<input>>" in full_content:
            annotation_type = "input"

        if not annotation_type:
            return None

        fields = {}

        # Known top-level annotation keys
        TOP_LEVEL_KEYS = {
            "template", "input", "output", "outputMode", "method", "url",
            "headers", "body", "timeout", "retries", "strategy", "inputs",
            "routes", "agent", "separator", "variables", "mode", "outputSchema"
        }

        # Parse YAML-like fields
        current_key = None
        current_value = []
        in_multiline = False
        in_block = False  # True when collecting list/block content for a key

        i = 0
        while i < len(content):
            line = content[i]

            # Skip annotation type markers
            if line.startswith("<<") and line.endswith(">>"):
                i += 1
                continue

            # Check if line starts with a list marker
            is_list_item = line.strip().startswith("- ")

            # If we're in block mode collecting content
            if in_block:
                # Check if this is a new top-level key
                if ":" in line and not is_list_item:
                    potential_key = line.partition(":")[0].strip()
                    if potential_key in TOP_LEVEL_KEYS:
                        # This is a new top-level key, end current block
                        fields[current_key] = self._process_value(current_key, current_value)
                        in_block = False
                        current_key = None
                        current_value = []
                        # Fall through to process this line as new key
                    else:
                        # This is a property within the block (e.g., "type: string")
                        current_value.append(line)
                        i += 1
                        continue
                else:
                    # List item or other content, collect it
                    current_value.append(line)
                    i += 1
                    continue

            # Check for top-level key: value
            if ":" in line and not in_multiline:
                # Save previous key if exists
                if current_key:
                    fields[current_key] = self._process_value(current_key, current_value)

                key, _, value = line.partition(":")
                key = key.strip()
                value = value.strip()

                # Check for multiline (|)
                if value == "|":
                    in_multiline = True
                    current_key = key
                    current_value = []
                # Check for inline object/array
                elif value.startswith("{") or value.startswith("["):
                    current_key = key
                    current_value = [value]
                    # Check if it spans multiple lines
                    if not (value.endswith("}") or value.endswith("]")):
                        in_multiline = True
                    else:
                        fields[key] = self._process_value(key, current_value)
                        current_key = None
                        current_value = []
                # Check for empty value (could be followed by list items)
                elif value == "":
                    current_key = key
                    current_value = []
                    in_block = True  # Start collecting block content
                else:
                    fields[key] = self._parse_simple_value(value)
                    current_key = None
                    current_value = []
            elif in_multiline:
                current_value.append(line)
                # Check for end of object/array
                if line.strip().endswith("}") or line.strip().endswith("]"):
                    fields[current_key] = self._process_value(current_key, current_value)
                    in_multiline = False
                    current_key = None
                    current_value = []

            i += 1

        # Save final key if exists
        if current_key:
            fields[current_key] = self._process_value(current_key, current_value)

        return ParsedAnnotation(type=annotation_type, fields=fields)

    def _process_value(self, key: str, value_lines: list[str]) -> Any:
        """Process multiline or complex value."""
        if not value_lines:
            return ""

        # Join lines
        value_str = "\n".join(value_lines)

        # Try to parse as JSON-like
        if value_str.strip().startswith("{") or value_str.strip().startswith("["):
            try:
                import json
                # Clean up YAML-style to JSON
                cleaned = value_str.replace("'", '"')
                return json.loads(cleaned)
            except Exception:
                return value_str

        # For variables lists
        if key == "variables":
            return self._parse_variables_list(value_lines)

        # For routes lists
        if key == "routes":
            return self._parse_routes_list(value_lines)

        return value_str.strip()

    def _parse_simple_value(self, value: str) -> Any:
        """Parse a simple value string."""
        value = value.strip()

        # Remove quotes
        if (value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'")):
            return value[1:-1]

        # Boolean
        if value.lower() == "true":
            return True
        if value.lower() == "false":
            return False

        # Number
        try:
            if "." in value:
                return float(value)
            return int(value)
        except ValueError:
            pass

        return value

    def _parse_variables_list(self, lines: list[str]) -> list[dict]:
        """Parse a list of variable definitions.

        Handles YAML-style list items like:
        - name: code
          type: string
          required: true
        - name: language
          type: string
        """
        variables = []
        current_var = {}

        for line in lines:
            line = line.strip()

            # New list item
            if line.startswith("- "):
                # Save previous variable
                if current_var:
                    variables.append(current_var)
                current_var = {"type": "string", "required": False}

                # Parse the first key:value on the same line as -
                rest = line[2:].strip()  # Remove "- "
                if ":" in rest:
                    key, _, value = rest.partition(":")
                    key = key.strip()
                    value = value.strip()
                    if key == "name":
                        current_var["name"] = value
                    elif key == "type":
                        current_var["type"] = value
                    elif key == "required":
                        current_var["required"] = value.lower() == "true"
                    elif key == "default":
                        current_var["default"] = value

            # Property of current list item (not starting with -)
            elif ":" in line and current_var:
                key, _, value = line.partition(":")
                key = key.strip()
                value = value.strip()
                if key == "name":
                    current_var["name"] = value
                elif key == "type":
                    current_var["type"] = value
                elif key == "required":
                    current_var["required"] = value.lower() == "true"
                elif key == "default":
                    current_var["default"] = value

        if current_var and "name" in current_var:
            variables.append(current_var)

        return variables

    def _parse_routes_list(self, lines: list[str]) -> list[dict]:
        """Parse a list of route definitions."""
        routes = []
        current_route = {}

        for line in lines:
            line = line.strip()
            if line.startswith("- category:"):
                if current_route:
                    routes.append(current_route)
                current_route = {"category": self._parse_simple_value(line.split(":", 1)[1])}
            elif line.startswith("target:"):
                current_route["target"] = line.split(":", 1)[1].strip()

        if current_route:
            routes.append(current_route)

        return routes

    def _parse_condition(self, lines: list[str], start_idx: int, current_swimlane: str | None, is_elseif: bool = False) -> tuple[ParsedCondition, int]:
        """Parse an if/else/endif block."""
        if is_elseif:
            elseif_match = self.ELSEIF_PATTERN.match(lines[start_idx])
            expression = elseif_match.group(1).strip()
        else:
            if_match = self.IF_PATTERN.match(lines[start_idx])
            expression = if_match.group(1).strip()

        # Parse condition expression
        variable, operator, value = self._parse_condition_expression(expression)

        condition = ParsedCondition(
            expression=expression,
            variable=variable,
            operator=operator,
            value=value,
        )

        i = start_idx + 1
        current_branch = "true"
        swimlane = current_swimlane

        while i < len(lines):
            line = lines[i]

            # Swimlane change
            if line.startswith("|") and line.endswith("|"):
                parts = line.strip("|").split("|")
                name = parts[-1] if len(parts) > 1 else parts[0]
                if name.startswith("#"):
                    name = parts[-1] if len(parts) > 1 else name.lstrip("#")
                swimlane = name.strip()
                i += 1
                continue

            # Else branch
            if self.ELSE_PATTERN.match(line):
                current_branch = "false"
                i += 1
                continue

            # Elseif - switch to false branch and create nested condition
            elseif_match = self.ELSEIF_PATTERN.match(line)
            if elseif_match:
                # Parse the elseif as a nested condition in the false branch
                # The nested condition will return at the next elseif/else/endif
                nested_condition, end_idx = self._parse_condition(lines, i, swimlane, is_elseif=True)
                condition.false_branch.append(nested_condition)
                # If the nested condition ended at endif, we should also return
                # (else if chains share the same endif)
                if self.ENDIF_PATTERN.match(lines[end_idx]):
                    return condition, end_idx
                # Otherwise continue from where the nested condition stopped
                i = end_idx + 1
                continue

            # End of condition
            if self.ENDIF_PATTERN.match(line):
                return condition, i

            # Nested if
            if self.IF_PATTERN.match(line):
                nested_condition, end_idx = self._parse_condition(lines, i, swimlane)
                if current_branch == "true":
                    condition.true_branch.append(nested_condition)
                else:
                    condition.false_branch.append(nested_condition)
                i = end_idx + 1
                continue

            # Nested fork
            if self.FORK_PATTERN.match(line):
                nested_fork, end_idx = self._parse_fork(lines, i, swimlane)
                if current_branch == "true":
                    condition.true_branch.append(nested_fork)
                else:
                    condition.false_branch.append(nested_fork)
                i = end_idx + 1
                continue

            # Activity
            activity_match = self.ACTIVITY_PATTERN.match(line)
            if activity_match:
                label = activity_match.group(1).strip()
                annotation = None

                if i + 1 < len(lines) and lines[i + 1].startswith("note"):
                    annotation, note_end = self._parse_note(lines, i + 1)
                    i = note_end + 1
                else:
                    i += 1

                activity = ParsedActivity(label=label, swimlane=swimlane, annotation=annotation)
                if current_branch == "true":
                    condition.true_branch.append(activity)
                else:
                    condition.false_branch.append(activity)
                continue

            # Stop node in branch
            if line == "stop":
                activity = ParsedActivity(label="End", swimlane=swimlane, annotation=ParsedAnnotation(type="stop"))
                if current_branch == "true":
                    condition.true_branch.append(activity)
                else:
                    condition.false_branch.append(activity)
                i += 1
                continue

            i += 1

        raise PlantUMLParseError("Unclosed if/endif block", line=start_idx)

    def _parse_condition_expression(self, expression: str) -> tuple[str, str, str]:
        """Parse a condition expression into variable, operator, value."""
        match = self.CONDITION_EXPR_PATTERN.match(expression)
        if match:
            variable = match.group(1).lstrip("$")
            operator = match.group(2)
            value = match.group(3).strip().strip('"').strip("'")
            return variable, operator, value

        # Default fallback
        return expression, "==", "true"

    def _parse_fork(self, lines: list[str], start_idx: int, current_swimlane: str | None) -> tuple[ParsedFork, int]:
        """Parse a fork/fork again/end fork block."""
        fork = ParsedFork()
        current_branch = []
        swimlane = current_swimlane
        i = start_idx + 1

        while i < len(lines):
            line = lines[i]

            # Swimlane change
            if line.startswith("|") and line.endswith("|"):
                parts = line.strip("|").split("|")
                name = parts[-1] if len(parts) > 1 else parts[0]
                if name.startswith("#"):
                    name = parts[-1] if len(parts) > 1 else name.lstrip("#")
                swimlane = name.strip()
                i += 1
                continue

            # Fork again - start new branch
            if self.FORK_AGAIN_PATTERN.match(line):
                if current_branch:
                    fork.branches.append(current_branch)
                current_branch = []
                i += 1
                continue

            # End fork
            if self.END_FORK_PATTERN.match(line):
                if current_branch:
                    fork.branches.append(current_branch)
                return fork, i

            # Nested condition
            if self.IF_PATTERN.match(line):
                nested_condition, end_idx = self._parse_condition(lines, i, swimlane)
                current_branch.append(nested_condition)
                i = end_idx + 1
                continue

            # Nested fork
            if self.FORK_PATTERN.match(line):
                nested_fork, end_idx = self._parse_fork(lines, i, swimlane)
                current_branch.append(nested_fork)
                i = end_idx + 1
                continue

            # Activity
            activity_match = self.ACTIVITY_PATTERN.match(line)
            if activity_match:
                label = activity_match.group(1).strip()
                annotation = None

                if i + 1 < len(lines) and lines[i + 1].startswith("note"):
                    annotation, note_end = self._parse_note(lines, i + 1)
                    i = note_end + 1
                else:
                    i += 1

                current_branch.append(ParsedActivity(label=label, swimlane=swimlane, annotation=annotation))
                continue

            i += 1

        raise PlantUMLParseError("Unclosed fork/end fork block", line=start_idx)

    def _parse_split(self, lines: list[str], start_idx: int, current_swimlane: str | None) -> tuple[ParsedFork, int]:
        """Parse a split/split again/end split block (treat like fork)."""
        fork = ParsedFork()
        current_branch = []
        swimlane = current_swimlane
        i = start_idx + 1

        while i < len(lines):
            line = lines[i]

            # Swimlane change
            if line.startswith("|") and line.endswith("|"):
                parts = line.strip("|").split("|")
                name = parts[-1] if len(parts) > 1 else parts[0]
                if name.startswith("#"):
                    name = parts[-1] if len(parts) > 1 else name.lstrip("#")
                swimlane = name.strip()
                i += 1
                continue

            # Split again - start new branch
            if self.SPLIT_AGAIN_PATTERN.match(line):
                if current_branch:
                    fork.branches.append(current_branch)
                current_branch = []
                i += 1
                continue

            # End split
            if self.END_SPLIT_PATTERN.match(line):
                if current_branch:
                    fork.branches.append(current_branch)
                return fork, i

            # Activity
            activity_match = self.ACTIVITY_PATTERN.match(line)
            if activity_match:
                label = activity_match.group(1).strip()
                annotation = None

                if i + 1 < len(lines) and lines[i + 1].startswith("note"):
                    annotation, note_end = self._parse_note(lines, i + 1)
                    i = note_end + 1
                else:
                    i += 1

                current_branch.append(ParsedActivity(label=label, swimlane=swimlane, annotation=annotation))
                continue

            i += 1

        raise PlantUMLParseError("Unclosed split/end split block", line=start_idx)

    def _parse_repeat(self, lines: list[str], start_idx: int, current_swimlane: str | None) -> tuple[ParsedLoop, int]:
        """Parse a repeat/repeat while block."""
        loop = ParsedLoop()
        swimlane = current_swimlane
        i = start_idx + 1

        while i < len(lines):
            line = lines[i]

            # Swimlane change
            if line.startswith("|") and line.endswith("|"):
                parts = line.strip("|").split("|")
                name = parts[-1] if len(parts) > 1 else parts[0]
                if name.startswith("#"):
                    name = parts[-1] if len(parts) > 1 else name.lstrip("#")
                swimlane = name.strip()
                i += 1
                continue

            # Repeat while - end of loop
            repeat_while_match = self.REPEAT_WHILE_PATTERN.match(line)
            if repeat_while_match:
                loop.condition = repeat_while_match.group(1).strip()
                return loop, i

            # Nested condition
            if self.IF_PATTERN.match(line):
                nested_condition, end_idx = self._parse_condition(lines, i, swimlane)
                loop.body.append(nested_condition)
                i = end_idx + 1
                continue

            # Activity
            activity_match = self.ACTIVITY_PATTERN.match(line)
            if activity_match:
                label = activity_match.group(1).strip()
                annotation = None

                if i + 1 < len(lines) and lines[i + 1].startswith("note"):
                    annotation, note_end = self._parse_note(lines, i + 1)
                    i = note_end + 1
                else:
                    i += 1

                loop.body.append(ParsedActivity(label=label, swimlane=swimlane, annotation=annotation))
                continue

            i += 1

        raise PlantUMLParseError("Unclosed repeat/repeat while block", line=start_idx)


class WorkflowConverter:
    """Convert parsed PlantUML to workflow JSON."""

    def __init__(self):
        self._node_counter = 0
        self._edge_counter = 0

    def convert(
        self,
        parsed: dict,
        name: str | None = None,
        description: str | None = None,
        auto_layout: bool = True,
    ) -> dict:
        """Convert parsed PlantUML to workflow JSON.

        Returns:
            {
                'name': str,
                'description': str | None,
                'nodes': [...],
                'edges': [...],
                'agentMappings': [...],
                'inputVariables': [...],
                'warnings': [...]
            }
        """
        self._node_counter = 0
        self._edge_counter = 0
        self._pending_fork_ends = []  # Track branch endpoints that need connection

        nodes = []
        edges = []
        warnings = []
        agent_node_map = {}  # swimlane -> [node_ids]

        # Process body elements
        prev_node_id = None
        for element in parsed.get("body", []):
            node_ids, element_edges, last_id = self._convert_element(element, prev_node_id, agent_node_map)
            nodes.extend(node_ids)
            edges.extend(element_edges)
            prev_node_id = last_id

        # Build agent mappings
        agent_mappings = []
        swimlane_colors = {s["name"]: s["color"] for s in parsed.get("swimlanes", [])}
        for swimlane, node_ids in agent_node_map.items():
            if swimlane:
                agent_mappings.append({
                    "logicalName": swimlane,
                    "swimlaneColor": swimlane_colors.get(swimlane),
                    "nodeIds": node_ids,
                })

        # Auto-layout
        if auto_layout and nodes:
            nodes = self._calculate_positions(nodes, edges)

        return {
            "name": name or parsed.get("title", "Untitled"),
            "description": description or parsed.get("description"),
            "nodes": nodes,
            "edges": edges,
            "agentMappings": agent_mappings,
            "inputVariables": parsed.get("input_vars", []),
            "warnings": warnings,
        }

    def _convert_element(
        self,
        element,
        prev_node_id: str | None,
        agent_node_map: dict,
    ) -> tuple[list[dict], list[dict], str | None]:
        """Convert a parsed element to nodes and edges.

        Returns (nodes, edges, last_node_id)
        """
        if isinstance(element, ParsedActivity):
            return self._convert_activity(element, prev_node_id, agent_node_map)
        elif isinstance(element, ParsedCondition):
            return self._convert_condition(element, prev_node_id, agent_node_map)
        elif isinstance(element, ParsedFork):
            return self._convert_fork(element, prev_node_id, agent_node_map)
        elif isinstance(element, ParsedLoop):
            return self._convert_loop(element, prev_node_id, agent_node_map)

        return [], [], prev_node_id

    def _convert_activity(
        self,
        activity: ParsedActivity,
        prev_node_id: str | None,
        agent_node_map: dict,
    ) -> tuple[list[dict], list[dict], str | None]:
        """Convert an activity to a node."""
        nodes = []
        edges = []

        # Determine node type and data
        node_type, node_data = self._activity_to_node(activity)
        node_id = self._generate_node_id(node_type, activity.label)

        node = {
            "id": node_id,
            "type": node_type,
            "position": {"x": 0, "y": 0},  # Will be set by auto-layout
            "data": node_data,
        }
        nodes.append(node)

        # Track agent mapping
        if activity.swimlane:
            if activity.swimlane not in agent_node_map:
                agent_node_map[activity.swimlane] = []
            agent_node_map[activity.swimlane].append(node_id)

        # Create edge from previous node
        if prev_node_id:
            edge = self._create_edge(prev_node_id, node_id)
            edges.append(edge)

        # Connect any pending fork branch endpoints to this node
        # (these are branches that need to merge, typically into an aggregator)
        for pending_id in self._pending_fork_ends:
            edge = self._create_edge(pending_id, node_id)
            edges.append(edge)
        self._pending_fork_ends = []  # Clear after connecting

        return nodes, edges, node_id

    def _activity_to_node(self, activity: ParsedActivity) -> tuple[str, dict]:
        """Convert activity to node type and data."""
        annotation = activity.annotation

        if annotation is None:
            # Default to promptBlock
            return "promptBlock", {
                "label": activity.label,
                "agentId": None,
                "promptTemplateId": None,
                "variableBindings": [],
                "status": "idle",
            }

        if annotation.type == "start":
            return "workflowStart", {
                "label": activity.label,
                "status": "idle",
            }

        if annotation.type == "stop":
            return "output", {
                "label": activity.label,
                "results": [],
                "status": "idle",
            }

        if annotation.type == "prompt":
            fields = annotation.fields
            variable_bindings = self._parse_input_variables(fields.get("input", ""))

            return "promptBlock", {
                "label": activity.label,
                "agentId": None,
                "promptTemplateId": fields.get("template"),
                "variableBindings": variable_bindings,
                "status": "idle",
            }

        if annotation.type == "http":
            fields = annotation.fields
            return "httpRequest", {
                "label": activity.label,
                "method": fields.get("method", "GET"),
                "url": fields.get("url", ""),
                "headers": fields.get("headers", {}),
                "body": fields.get("body"),
                "status": "idle",
            }

        if annotation.type == "router":
            fields = annotation.fields
            routes = fields.get("routes", [])
            route_names = [r.get("category", r.get("target", f"Route {i+1}")) for i, r in enumerate(routes)]

            return "router", {
                "label": activity.label,
                "routes": route_names,
                "status": "idle",
            }

        if annotation.type == "aggregator":
            fields = annotation.fields
            return "aggregator", {
                "label": activity.label,
                "mode": fields.get("strategy", "concatenate"),
                "strategy": fields.get("strategy", "concatenate"),
                "status": "idle",
            }

        # Default
        return "promptBlock", {
            "label": activity.label,
            "agentId": None,
            "promptTemplateId": None,
            "variableBindings": [],
            "status": "idle",
        }

    def _parse_input_variables(self, input_str: str) -> list[dict]:
        """Parse input variable string into variable bindings."""
        bindings = []
        if not input_str:
            return bindings

        # Find all {{variable}} patterns
        pattern = re.compile(r"\{\{(\w+(?:\.\w+)?)\}\}")
        for match in pattern.finditer(input_str):
            var_name = match.group(1)
            bindings.append({
                "variableName": var_name,
                "source": "upstream",
            })

        # Also check for $VARIABLE patterns
        pattern = re.compile(r"\$(\w+)")
        for match in pattern.finditer(input_str):
            var_name = match.group(1)
            if not any(b["variableName"] == var_name for b in bindings):
                bindings.append({
                    "variableName": var_name,
                    "source": "upstream",
                })

        return bindings

    def _convert_condition(
        self,
        condition: ParsedCondition,
        prev_node_id: str | None,
        agent_node_map: dict,
    ) -> tuple[list[dict], list[dict], str | None]:
        """Convert a condition to nodes and edges."""
        nodes = []
        edges = []

        # Create condition node
        node_id = self._generate_node_id("condition", condition.expression)
        condition_node = {
            "id": node_id,
            "type": "condition",
            "position": {"x": 0, "y": 0},
            "data": {
                "label": f"If {condition.expression}",
                "variable": condition.variable,
                "operator": condition.operator,
                "value": condition.value,
                "status": "idle",
            },
        }
        nodes.append(condition_node)

        # Edge from previous node
        if prev_node_id:
            edges.append(self._create_edge(prev_node_id, node_id))

        # Process true branch
        true_last_id = node_id
        for element in condition.true_branch:
            element_nodes, element_edges, last_id = self._convert_element(element, true_last_id, agent_node_map)
            nodes.extend(element_nodes)
            edges.extend(element_edges)
            # Set source handle for first edge in true branch
            if element_edges and element_edges[0]["source"] == node_id:
                element_edges[0]["sourceHandle"] = "true"
            true_last_id = last_id

        # Process false branch
        false_last_id = node_id
        for element in condition.false_branch:
            element_nodes, element_edges, last_id = self._convert_element(element, false_last_id, agent_node_map)
            nodes.extend(element_nodes)
            edges.extend(element_edges)
            # Set source handle for first edge in false branch
            if element_edges and element_edges[0]["source"] == node_id:
                element_edges[0]["sourceHandle"] = "false"
            false_last_id = last_id

        # Return the last node ID (could be from either branch, or condition itself if empty)
        # For proper merging, caller may need to handle both branch endings
        return nodes, edges, true_last_id if true_last_id != node_id else false_last_id

    def _convert_fork(
        self,
        fork: ParsedFork,
        prev_node_id: str | None,
        agent_node_map: dict,
    ) -> tuple[list[dict], list[dict], str | None]:
        """Convert a fork to nodes and edges."""
        nodes = []
        edges = []
        branch_last_ids = []

        for branch in fork.branches:
            branch_prev_id = prev_node_id
            for element in branch:
                element_nodes, element_edges, last_id = self._convert_element(element, branch_prev_id, agent_node_map)
                nodes.extend(element_nodes)
                edges.extend(element_edges)
                branch_prev_id = last_id

            if branch_prev_id and branch_prev_id != prev_node_id:
                branch_last_ids.append(branch_prev_id)

        # Store all branch endpoints except the first for later connection
        # The first one is returned as last_id and will be connected normally
        # Additional branches are stored in _pending_fork_ends to be connected
        # to the next node (typically an aggregator)
        if len(branch_last_ids) > 1:
            self._pending_fork_ends.extend(branch_last_ids[1:])

        return nodes, edges, branch_last_ids[0] if branch_last_ids else prev_node_id

    def _convert_loop(
        self,
        loop: ParsedLoop,
        prev_node_id: str | None,
        agent_node_map: dict,
    ) -> tuple[list[dict], list[dict], str | None]:
        """Convert a loop to nodes and edges (using evaluator pattern)."""
        nodes = []
        edges = []

        # Process loop body
        body_first_id = None
        body_last_id = prev_node_id

        for element in loop.body:
            element_nodes, element_edges, last_id = self._convert_element(element, body_last_id, agent_node_map)
            nodes.extend(element_nodes)
            edges.extend(element_edges)

            if body_first_id is None and element_nodes:
                body_first_id = element_nodes[0]["id"]

            body_last_id = last_id

        # Create evaluator node
        evaluator_id = self._generate_node_id("evaluator", loop.condition)
        evaluator_node = {
            "id": evaluator_id,
            "type": "evaluator",
            "position": {"x": 0, "y": 0},
            "data": {
                "label": f"Evaluate: {loop.condition}",
                "maxIterations": 3,
                "iteration": 0,
                "status": "idle",
            },
        }
        nodes.append(evaluator_node)

        # Edge from last body element to evaluator
        if body_last_id:
            edges.append(self._create_edge(body_last_id, evaluator_id))

        # Loop-back edge from evaluator (rejected) to first body element
        if body_first_id:
            loop_edge = self._create_edge(evaluator_id, body_first_id)
            loop_edge["sourceHandle"] = "rejected"
            edges.append(loop_edge)

        return nodes, edges, evaluator_id

    def _generate_node_id(self, node_type: str, label: str) -> str:
        """Generate a unique node ID."""
        self._node_counter += 1
        # Sanitize label for ID
        safe_label = re.sub(r"[^a-zA-Z0-9]", "-", label.lower())[:20]
        return f"{node_type}-{safe_label}-{self._node_counter}"

    def _create_edge(self, source: str, target: str) -> dict:
        """Create an edge between two nodes."""
        self._edge_counter += 1
        return {
            "id": f"e{self._edge_counter}",
            "source": source,
            "target": target,
            "animated": True,
        }

    def _calculate_positions(self, nodes: list[dict], edges: list[dict]) -> list[dict]:
        """Calculate node positions using hierarchical layout.

        Uses BFS from workflowStart to assign levels.
        X = level * 400
        Y = centered within level, parallel branches stacked vertically
        """
        if not nodes:
            return nodes

        # Build adjacency map
        adjacency = {node["id"]: [] for node in nodes}
        reverse_adj = {node["id"]: [] for node in nodes}

        for edge in edges:
            source = edge["source"]
            target = edge["target"]
            if source in adjacency:
                adjacency[source].append(target)
            if target in reverse_adj:
                reverse_adj[target].append(source)

        # Find start node
        start_node = None
        for node in nodes:
            if node["type"] == "workflowStart":
                start_node = node["id"]
                break

        if not start_node:
            # Fallback: find node with no incoming edges
            for node in nodes:
                if not reverse_adj.get(node["id"]):
                    start_node = node["id"]
                    break

        if not start_node and nodes:
            start_node = nodes[0]["id"]

        # BFS to assign levels
        levels = {start_node: 0}
        queue = [start_node]
        visited = {start_node}

        while queue:
            current = queue.pop(0)
            current_level = levels[current]

            for neighbor in adjacency.get(current, []):
                if neighbor not in visited:
                    visited.add(neighbor)
                    levels[neighbor] = current_level + 1
                    queue.append(neighbor)

        # Handle nodes not reachable from start
        for node in nodes:
            if node["id"] not in levels:
                levels[node["id"]] = 0

        # Group nodes by level
        level_nodes = {}
        for node_id, level in levels.items():
            if level not in level_nodes:
                level_nodes[level] = []
            level_nodes[level].append(node_id)

        # Assign positions
        node_positions = {}
        x_spacing = 400
        y_spacing = 150

        for level, node_ids in level_nodes.items():
            x = 50 + level * x_spacing
            # Center nodes vertically
            total_height = (len(node_ids) - 1) * y_spacing
            start_y = 200 - total_height / 2

            for i, node_id in enumerate(node_ids):
                y = start_y + i * y_spacing
                node_positions[node_id] = {"x": x, "y": y}

        # Apply positions to nodes
        for node in nodes:
            if node["id"] in node_positions:
                node["position"] = node_positions[node["id"]]

        return nodes
