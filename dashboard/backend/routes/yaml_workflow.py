"""YAML Workflow conversion API routes."""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from services.yaml_workflow_parser import YAMLWorkflowConverter, YAMLWorkflowError

router = APIRouter(prefix="/api/workflows", tags=["workflows"])


class YAMLConvertRequest(BaseModel):
    """Request body for YAML conversion."""

    yaml: str
    name: str | None = None
    description: str | None = None


@router.post("/from-yaml")
async def convert_yaml_to_workflow(
    request: YAMLConvertRequest,
    project_path: str | None = Query(None, description="Project path for context"),
) -> dict:
    """Convert YAML workflow definition to workflow JSON.

    The YAML should follow the workflow schema with:
    - workflow.name: Workflow name
    - workflow.description: Optional description
    - workflow.agents: Optional agent definitions
    - workflow.inputs: Optional input variable definitions
    - workflow.steps: List of workflow steps

    Supported step types:
    - prompt: AI prompt task
    - http: HTTP request
    - if/else: Conditional branching
    - parallel: Parallel execution
    - aggregate: Merge parallel results
    - loop: Repeat until condition
    - router: Dynamic routing
    """
    try:
        converter = YAMLWorkflowConverter()
        result = converter.convert(request.yaml)

        # Override name/description if provided
        if request.name:
            result["name"] = request.name
        if request.description:
            result["description"] = request.description

        return result

    except YAMLWorkflowError as e:
        raise HTTPException(
            status_code=400,
            detail={
                "error": e.message,
                "path": e.path,
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error": str(e)}
        )
