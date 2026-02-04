#!/usr/bin/env python3
"""
Multi-Agent Dashboard Backend

FastAPI server that:
- Connects to all agents via WebSocket
- Aggregates events and broadcasts to dashboard clients
- Handles prompt routing
"""

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from services import (
    BroadcastService,
    AgentManager,
    RegistryService,
    HeartbeatService,
    SpawnerService,
)
from routes import agents_router, flows_router, http_router, project_router, prompts_router, websocket_router
from routes import agents as agents_route
from routes import websocket as websocket_route


# Initialize services
broadcast = BroadcastService()
agent_manager = AgentManager(broadcast)
registry_service = RegistryService(agent_manager, broadcast)
heartbeat_service = HeartbeatService(agent_manager, broadcast)
spawner_service = SpawnerService(broadcast)

# Initialize route dependencies
agents_route.init(agent_manager, broadcast)
websocket_route.init(agent_manager, broadcast, spawner_service)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage startup and shutdown."""
    # Startup: launch background tasks
    registry_task = asyncio.create_task(registry_service.start())
    heartbeat_task = asyncio.create_task(heartbeat_service.start())

    yield

    # Shutdown: cancel tasks
    registry_task.cancel()
    heartbeat_task.cancel()
    registry_service.stop()


app = FastAPI(title="Multi-Agent Dashboard", lifespan=lifespan)

# CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(agents_router)
app.include_router(flows_router)
app.include_router(http_router)
app.include_router(project_router)
app.include_router(prompts_router)
app.include_router(websocket_router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
