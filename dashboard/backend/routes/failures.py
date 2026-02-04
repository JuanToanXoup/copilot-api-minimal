"""Failures API routes - ingest and manage test failures."""

from typing import Any, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel

from services.pipeline_executor import PipelineExecutor

router = APIRouter(prefix="/api/failures", tags=["failures"])

# Module-level reference to pipeline executor (set via init)
_pipeline_executor: Optional[PipelineExecutor] = None


def init(pipeline_executor: PipelineExecutor) -> None:
    """Initialize route with pipeline executor."""
    global _pipeline_executor
    _pipeline_executor = pipeline_executor


# ==================== Request Models ====================

class FailureCreate(BaseModel):
    """Request body for creating a failure."""
    test_file: str
    test_name: str = ""
    error_message: str
    stack_trace: Optional[str] = None
    expected: Optional[str] = None
    actual: Optional[str] = None
    context: Optional[dict] = None
    workflow_id: Optional[str] = None  # Override active workflow
    auto_execute: bool = True  # Start pipeline immediately


class WorkflowActivate(BaseModel):
    """Request body for activating a workflow."""
    workflow_id: str
    project_path: Optional[str] = None  # Project path for loading prompts


# ==================== Endpoints ====================

@router.post("")
async def create_failure(body: FailureCreate) -> dict[str, Any]:
    """
    Ingest a test failure and optionally start pipeline execution.

    This is the main entry point for the self-healing workflow.
    Call this endpoint when a test fails to trigger the pipeline.
    """
    if not _pipeline_executor:
        return {"error": "Pipeline executor not initialized"}

    # Create the failure record
    failure = _pipeline_executor.create_failure({
        "test_file": body.test_file,
        "test_name": body.test_name,
        "error_message": body.error_message,
        "stack_trace": body.stack_trace,
        "expected": body.expected,
        "actual": body.actual,
        "context": body.context or {},
    })

    # Queue for execution if requested
    if body.auto_execute:
        workflow_id = body.workflow_id or _pipeline_executor.get_active_workflow()
        if workflow_id:
            await _pipeline_executor.queue_failure(failure["id"], workflow_id)
            return {
                "status": "queued",
                "failure_id": failure["id"],
                "workflow_id": workflow_id,
            }
        else:
            return {
                "status": "created",
                "failure_id": failure["id"],
                "message": "No active workflow set. Use POST /api/failures/workflow to set one.",
            }

    return {
        "status": "created",
        "failure_id": failure["id"],
    }


@router.get("")
async def list_failures(
    status: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(50, description="Max results"),
) -> list[dict[str, Any]]:
    """List all failures, optionally filtered by status."""
    if not _pipeline_executor:
        return []

    if status:
        failures = _pipeline_executor.get_failures_by_status(status)
    else:
        failures = _pipeline_executor.get_all_failures()

    return failures[:limit]


@router.get("/stats")
async def get_failure_stats() -> dict[str, Any]:
    """Get failure statistics."""
    if not _pipeline_executor:
        return {"total": 0}

    failures = _pipeline_executor.get_all_failures()

    stats = {
        "total": len(failures),
        "pending": len([f for f in failures if f["status"] == "pending"]),
        "running": len([f for f in failures if f["status"] == "running"]),
        "completed": len([f for f in failures if f["status"] == "completed"]),
        "failed": len([f for f in failures if f["status"] == "failed"]),
        "escalated": len([f for f in failures if f["status"] == "escalated"]),
    }

    # Calculate success rate
    finished = stats["completed"] + stats["failed"]
    stats["success_rate"] = (
        round(stats["completed"] / finished * 100, 1) if finished > 0 else 0
    )

    return stats


@router.get("/{failure_id}")
async def get_failure(failure_id: str) -> dict[str, Any]:
    """Get a specific failure by ID."""
    if not _pipeline_executor:
        return {"error": "Pipeline executor not initialized"}

    failure = _pipeline_executor.get_failure(failure_id)
    if not failure:
        return {"error": "Failure not found"}

    # Include pipeline state if exists
    pipeline = _pipeline_executor.pipelines.get(failure_id)
    if pipeline:
        return {
            **failure,
            "pipeline": {
                "execution_order": pipeline["execution_order"],
                "current_index": pipeline["current_index"],
                "tasks": pipeline["tasks"],
            },
        }

    return failure


@router.post("/{failure_id}/retry")
async def retry_failure(failure_id: str) -> dict[str, Any]:
    """Retry a failed failure."""
    if not _pipeline_executor:
        return {"error": "Pipeline executor not initialized"}

    failure = _pipeline_executor.get_failure(failure_id)
    if not failure:
        return {"error": "Failure not found"}

    if failure["status"] not in ("failed", "escalated"):
        return {"error": f"Cannot retry failure with status '{failure['status']}'"}

    # Reset and requeue
    failure["status"] = "pending"
    failure["retry_count"] += 1
    failure["node_results"] = {}
    failure["current_node_id"] = None

    workflow_id = failure.get("workflow_id") or _pipeline_executor.get_active_workflow()
    if workflow_id:
        await _pipeline_executor.queue_failure(failure_id, workflow_id)
        return {"status": "requeued", "failure_id": failure_id}

    return {"error": "No workflow set for failure"}


@router.post("/{failure_id}/escalate")
async def escalate_failure(failure_id: str) -> dict[str, Any]:
    """Escalate a failure for manual review."""
    if not _pipeline_executor:
        return {"error": "Pipeline executor not initialized"}

    failure = _pipeline_executor.get_failure(failure_id)
    if not failure:
        return {"error": "Failure not found"}

    failure["status"] = "escalated"
    await _pipeline_executor._broadcast_failure_update(failure)

    return {"status": "escalated", "failure_id": failure_id}


# ==================== Workflow Management ====================

@router.post("/workflow")
async def set_active_workflow(body: WorkflowActivate) -> dict[str, Any]:
    """Set the active workflow for processing failures."""
    if not _pipeline_executor:
        return {"error": "Pipeline executor not initialized"}

    # Verify workflow exists
    workflow = _pipeline_executor.load_workflow(body.workflow_id, body.project_path)
    if not workflow:
        return {"error": f"Workflow '{body.workflow_id}' not found"}

    _pipeline_executor.set_active_workflow(body.workflow_id, body.project_path)

    return {
        "status": "activated",
        "workflow_id": body.workflow_id,
        "workflow_name": workflow.get("name", body.workflow_id),
    }


@router.get("/workflow/active")
async def get_active_workflow() -> dict[str, Any]:
    """Get the currently active workflow."""
    if not _pipeline_executor:
        return {"error": "Pipeline executor not initialized"}

    workflow_id = _pipeline_executor.get_active_workflow()
    if not workflow_id:
        return {"active": False, "workflow_id": None}

    workflow = _pipeline_executor.load_workflow(workflow_id)
    return {
        "active": True,
        "workflow_id": workflow_id,
        "workflow_name": workflow.get("name", workflow_id) if workflow else None,
    }


# ==================== Pipeline State ====================

@router.get("/{failure_id}/pipeline")
async def get_pipeline_state(failure_id: str) -> dict[str, Any]:
    """Get the pipeline execution state for a failure."""
    if not _pipeline_executor:
        return {"error": "Pipeline executor not initialized"}

    pipeline = _pipeline_executor.pipelines.get(failure_id)
    if not pipeline:
        return {"error": "No pipeline state found for this failure"}

    return pipeline
