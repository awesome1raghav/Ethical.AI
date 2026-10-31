import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.core.execution_context import ExecutionContext
from app.services.runtime.execution_runtime import ExecutionRuntime

logger = logging.getLogger(__name__)

router = APIRouter(
    tags=["WebSocket"]
)


@router.websocket("/ws/mission/{mission_id}")
async def websocket_mission_stream(websocket: WebSocket, mission_id: str):

    await websocket.accept()

    try:
        await websocket.send_json({
            "step": "Connection",
            "status": "SUCCESS",
            "message": f"Connected to mission stream: {mission_id}"
        })

        data_text = await websocket.receive_text()
        try:
            data = json.loads(data_text)
            prompt = data.get("prompt", data_text)
        except Exception:
            prompt = data_text

        context = ExecutionContext(
            mission_id=mission_id,
            prompt=prompt
        )

        context = ExecutionRuntime.execute(context)

        for event in context.events:
            await websocket.send_json(event)

        await websocket.send_json({
            "step": "MissionComplete",
            "status": "SUCCESS",
            "message": "Mission execution finished",
            "response": str(context.response) if context.response else None,
            "ai_response": str(context.ai_response) if context.ai_response else None
        })

    except WebSocketDisconnect:
        logger.info("Client disconnected from mission %s", mission_id)
    except Exception as e:
        await websocket.send_json({
            "step": "ExecutionError",
            "status": "ERROR",
            "message": str(e)
        })
        await websocket.close()
