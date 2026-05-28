"""Chat endpoints: POST /chat (blocking) and WS /ws/chat (streaming)."""
import asyncio
import json
import time

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from langchain_core.messages import HumanMessage
from loguru import logger

from backend.api.dependencies import get_jarvis_graph
from backend.models.chat import ChatRequest, ChatResponse, StreamChunk
from backend.core.file_extractor import build_file_context

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, graph=Depends(get_jarvis_graph)):
    config = {"configurable": {"thread_id": request.session_id or "default"}}
    state = await graph.ainvoke(
        {
            "messages": [HumanMessage(content=request.message)],
            "user_id": request.user_id,
            "session_id": request.session_id,
            "persona": request.persona,
        },
        config=config,
    )
    ai_message = state["messages"][-1]
    return ChatResponse(content=ai_message.content, session_id=request.session_id)


@router.websocket("/ws/chat")
async def ws_chat(websocket: WebSocket, graph=Depends(get_jarvis_graph)):
    await websocket.accept()
    logger.info(f"WebSocket conectado desde {websocket.client}")
    try:
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)

            if data.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
                continue

            message = data.get("message", "")
            session_id = data.get("session_id", "default")
            persona = data.get("persona", "profesional")
            attachments = data.get("attachments", [])

            if not message.strip() and not attachments:
                continue

            config = {"configurable": {"thread_id": session_id}}

            combined_message = message
            if attachments:
                file_keys = [a["key"] for a in attachments]
                filenames = [a.get("filename", a["key"].split("/")[-1]) for a in attachments]
                logger.info(f"WS chat: {len(attachments)} adjuntos session={session_id}")
                await websocket.send_text(
                    StreamChunk(type="file_uploaded", content=f"Procesando {len(attachments)} archivo(s)...").model_dump_json()
                )
                try:
                    file_context = build_file_context(file_keys, filenames)
                    combined_message = f"{file_context}\n\n{message}"
                except Exception as e:
                    logger.warning(f"Error extrayendo texto de adjuntos: {e}")
                    combined_message = f"[Archivos adjuntos no procesados: {e}]\n\n{message}"

            logger.info(f"WS chat: session={session_id}, persona={persona}, msg_len={len(message)}, attachments={len(attachments)}")

            # DIRECT INVOKE con streaming de tokens fake (más estable que astream_events)
            try:
                state = await asyncio.wait_for(
                    graph.ainvoke(
                        {
                            "messages": [HumanMessage(content=combined_message)],
                            "session_id": session_id,
                            "persona": persona,
                        },
                        config=config,
                    ),
                    timeout=120,
                )
                ai_message = state["messages"][-1]
                response_text = ai_message.content if hasattr(ai_message, "content") else str(ai_message)
                await websocket.send_text(StreamChunk(type="token", content=response_text).model_dump_json())
                await websocket.send_text(StreamChunk(type="done").model_dump_json())
                logger.info(f"WS chat completado session={session_id}")
            except asyncio.TimeoutError:
                await websocket.send_text(StreamChunk(type="error", content="Timeout: el modelo tardó más de 120s en responder.").model_dump_json())
                logger.warning(f"WS chat timeout session={session_id}")
            except Exception as e:
                logger.error(f"WS chat error: {e}")
                try:
                    await websocket.send_text(StreamChunk(type="error", content=str(e)[:500]).model_dump_json())
                except:
                    pass

    except WebSocketDisconnect:
        logger.info("WebSocket desconectado normalmente")
    except Exception as e:
        logger.error(f"WebSocket error critico: {e}")
