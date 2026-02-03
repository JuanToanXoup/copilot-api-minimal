"""API routes for the dashboard backend."""

from .agents import router as agents_router
from .flows import router as flows_router
from .websocket import router as websocket_router

__all__ = ["agents_router", "flows_router", "websocket_router"]
