"""API routes for the dashboard backend."""

from .agents import router as agents_router
from .flows import router as flows_router
from .http import router as http_router
from .prompts import router as prompts_router
from .websocket import router as websocket_router

__all__ = ["agents_router", "flows_router", "http_router", "prompts_router", "websocket_router"]
