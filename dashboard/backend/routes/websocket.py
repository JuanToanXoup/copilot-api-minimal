"""WebSocket route for dashboard clients."""

import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from services import AgentManager, BroadcastService, SpawnerService

router = APIRouter(tags=["websocket"])

# These will be set by the main app
_agent_manager: AgentManager = None
_broadcast: BroadcastService = None
_spawner: SpawnerService = None


def init(
    agent_manager: AgentManager,
    broadcast: BroadcastService,
    spawner: SpawnerService,
) -> None:
    """Initialize route dependencies."""
    global _agent_manager, _broadcast, _spawner
    _agent_manager = agent_manager
    _broadcast = broadcast
    _spawner = spawner


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket for dashboard clients."""
    await websocket.accept()
    await _broadcast.add_client(websocket)

    # Send initial state
    await websocket.send_text(json.dumps({
        "type": "initial",
        "agents": _agent_manager.get_agents_summary(),
        "activity": _broadcast.get_recent_activity(),
    }))

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            await _handle_message(websocket, message)

    except WebSocketDisconnect:
        await _broadcast.remove_client(websocket)


async def _handle_message(websocket: WebSocket, message: dict) -> None:
    """Handle incoming WebSocket message."""
    msg_type = message.get("type")

    if msg_type == "send_prompt":
        await _handle_send_prompt(websocket, message)

    elif msg_type == "send_to_port":
        await _handle_send_to_port(websocket, message)

    elif msg_type == "spawn_agent":
        await _handle_spawn_agent(websocket, message)


async def _handle_send_prompt(websocket: WebSocket, message: dict) -> None:
    """Handle send_prompt message.

    The plugin itself handles busy handoff — if it's busy, it will
    find a free sibling agent with the same project and delegate.
    """
    instance_id = message.get("instance_id")
    prompt = message.get("prompt")
    request_id = message.get("request_id")

    if not instance_id or not prompt:
        return

    conn = _agent_manager.get_connection(instance_id)
    if not conn:
        return

    result = await conn.send_prompt(prompt)
    response = {
        "type": "prompt_result",
        "instance_id": instance_id,
        "result": result,
    }
    if request_id:
        response["request_id"] = request_id

    await websocket.send_text(json.dumps(response))


async def _handle_send_to_port(websocket: WebSocket, message: dict) -> None:
    """Handle send_to_port message."""
    port = message.get("port")
    prompt = message.get("prompt")

    if not port or not prompt:
        return

    for instance_id, conn in _agent_manager.connections.items():
        if conn.entry.get("port") == port:
            if _agent_manager.agents.get(instance_id, {}).get("connected"):
                result = await conn.send_prompt(prompt)
                await websocket.send_text(json.dumps({
                    "type": "prompt_result",
                    "instance_id": instance_id,
                    "port": port,
                    "result": result,
                }))
                break


async def _handle_spawn_agent(websocket: WebSocket, message: dict) -> None:
    """Handle spawn_agent message."""
    print(f"[SPAWN] Received spawn request: {message}", flush=True)

    project_path = message.get("project_path")
    capabilities = message.get("capabilities", [])

    if not project_path:
        await websocket.send_text(json.dumps({
            "type": "spawn_result",
            "error": "project_path is required",
        }))
        return

    result = await _spawner.spawn(project_path, capabilities)
    await websocket.send_text(json.dumps({
        "type": "spawn_result",
        **result,
    }))
