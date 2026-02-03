"""Agent API routes."""

from fastapi import APIRouter

from services import AgentManager, BroadcastService

router = APIRouter(prefix="/api", tags=["agents"])

# These will be set by the main app
_agent_manager: AgentManager = None
_broadcast: BroadcastService = None


def init(agent_manager: AgentManager, broadcast: BroadcastService) -> None:
    """Initialize route dependencies."""
    global _agent_manager, _broadcast
    _agent_manager = agent_manager
    _broadcast = broadcast


@router.get("/agents")
async def get_agents():
    """Get all agents."""
    return _agent_manager.get_agents_summary()


@router.get("/activity")
async def get_activity():
    """Get activity log."""
    return _broadcast.activity_log
