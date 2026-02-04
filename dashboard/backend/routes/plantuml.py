"""PlantUML conversion API routes."""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from services.plantuml_parser import PlantUMLParser, WorkflowConverter, PlantUMLParseError

router = APIRouter(prefix="/api/workflows", tags=["workflows"])


class PlantUMLConvertRequest(BaseModel):
    """Request body for PlantUML conversion."""

    plantuml: str
    name: str | None = None
    description: str | None = None
    auto_layout: bool = True


@router.post("/from-plantuml")
async def convert_plantuml_to_workflow(
    request: PlantUMLConvertRequest,
    project_path: str | None = Query(None, description="Project path for context"),
) -> dict:
    """Convert PlantUML activity diagram to workflow JSON.

    The PlantUML text should follow the schema defined in docs/plantuml-workflow-schema.md.

    Returns a workflow JSON compatible with the React Flow workflow system, including:
    - nodes: React Flow nodes with type, position, and data
    - edges: React Flow edges connecting nodes
    - agentMappings: Mapping of swimlane names to node IDs for agent assignment
    - inputVariables: Workflow input variables extracted from annotations
    - warnings: Any parsing warnings
    """
    try:
        # Parse PlantUML
        parser = PlantUMLParser()
        parsed = parser.parse(request.plantuml)

        # Convert to workflow JSON
        converter = WorkflowConverter()
        workflow = converter.convert(
            parsed,
            name=request.name or parsed.get("title", "Untitled"),
            description=request.description,
            auto_layout=request.auto_layout,
        )

        return workflow

    except PlantUMLParseError as e:
        raise HTTPException(
            status_code=400,
            detail={
                "error": str(e),
                "line": e.line,
                "context": e.context,
            },
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error": f"Internal error: {str(e)}"},
        )
