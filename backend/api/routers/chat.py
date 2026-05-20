"""Chat endpoints: POST /chat (blocking) and WS /ws/chat (streaming)."""
import asyncio
import json
import time

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from langchain_core.messages import HumanMessage
from loguru import logger

from backend.api.dependencies import get_jarvis_graph
from backend.models.chat import ChatRequest, ChatResponse, StreamChunk

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, graph=Depends(get_jarvis_graph)):
    """Blocking chat endpoint. Invokes the graph and returns the final AI response."""
    config = {
        "configurable": {
            "thread_id": request.session_id or "default",
        }
    }

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
    """
    WebSocket streaming chat.
    Si el streaming falla, hace fallback a ainvoke (respuesta completa).
    """
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

            if not message.strip():
                continue

            config = {
                "configurable": {
                    "thread_id": session_id,
                }
            }

            logger.info(f"WS chat: session={session_id}, persona={persona}, msg_len={len(message)}")

            # ── Intento 1: Streaming con buffer ──────────────────────────
            try:
                token_buffer: list[str] = []
                last_send = time.time()
                has_tokens = False

                async for event in graph.astream_events(
                    {
                        "messages": [HumanMessage(content=message)],
                        "session_id": session_id,
                        "persona": persona,
                    },
                    config=config,
                    version="v2",
                ):
                    kind = event["event"]

                    if kind == "on_chat_model_stream":
                        chunk = event["data"]["chunk"]
                        token = chunk.content if hasattr(chunk, "content") else ""
                        if token:
                            has_tokens = True
                            token_buffer.append(token)
                            # Enviar cada 50ms o buffer > 10 tokens
                            now = time.time()
                            if now - last_send > 0.05 or len(token_buffer) > 10:
                                await websocket.send_text(
                                    StreamChunk(type="token", content="".join(token_buffer)).model_dump_json()
                                )
                                token_buffer = []
                                last_send = now

                    elif kind == "on_tool_start":
                        await websocket.send_text(
                            StreamChunk(
                                type="tool_start",
                                tool_name=event.get("name"),
                                tool_input=event["data"].get("input"),
                            ).model_dump_json()
                        )

                    elif kind == "on_tool_end":
                        await websocket.send_text(
                            StreamChunk(
                                type="tool_end",
                                tool_name=event.get("name"),
                                tool_output=event["data"].get("output"),
                            ).model_dump_json()
                        )

                # Enviar tokens restantes
                if token_buffer:
                    await websocket.send_text(
                        StreamChunk(type="token", content="".join(token_buffer)).model_dump_json()
                    )

                # Si NO llegó ningún token, fallback a ainvoke
                if not has_tokens:
                    raise RuntimeError("No streaming tokens received")

                await websocket.send_text(StreamChunk(type="done").model_dump_json())
                logger.info(f"WS streaming completado session={session_id}")

            except Exception as exc:
                # ── Intento 2: Fallback a ainvoke ────────────────────────
                logger.warning(f"Streaming fallo para session={session_id}: {exc}. Usando fallback ainvoke.")
                try:
                    state = await graph.ainvoke(
                        {
                            "messages": [HumanMessage(content=message)],
                            "session_id": session_id,
                            "persona": persona,
                        },
                        config=config,
                    )
                    ai_message = state["messages"][-1]
                    content = ai_message.content if hasattr(ai_message, "content") else str(ai_message)

                    # Simular streaming: enviar la respuesta en chunks
                    chunk_size = 20
                    for i in range(0, len(content), chunk_size):
                        await websocket.send_text(
                            StreamChunk(type="token", content=content[i:i+chunk_size]).model_dump_json()
                        )
                        await asyncio.sleep(0.01)

                    await websocket.send_text(StreamChunk(type="done").model_dump_json())
                    logger.info(f"WS fallback completado session={session_id}, len={len(content)}")
                except Exception as fallback_exc:
                    logger.error(f"Fallback tambien fallo: {fallback_exc}")
                    await websocket.send_text(
                        StreamChunk(type="error", content=str(fallback_exc)).model_dump_json()
                    )

    except WebSocketDisconnect:
        logger.info("WebSocket desconectado normalmente")
    except Exception as exc:
        logger.error(f"WebSocket error critico: {exc}")
        try:
            await websocket.send_text(
                StreamChunk(type="error", content=str(exc)).model_dump_json()
            )
        except Exception:
            pass
