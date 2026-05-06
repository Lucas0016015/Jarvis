"""API routes for messages."""
from typing import List, Any
from fastapi import APIRouter, HTTPException, Body

from backend.services.messages_service import (
    create_message,
    get_message,
    list_messages,
    delete_message,
    delete_thread_messages,
)

router = APIRouter()


@router.post("", summary="Create a new message")
async def create_message_route(
    thread_id: str = Body(..., embed=True),
    role: str = Body("user", embed=False),
    content: str = Body("", embed=False),
    metadata: dict[str, Any] | None = Body(None, embed=False),
):
    """Create a new message in a thread."""
    return create_message(
        thread_id=thread_id,
        role=role,
        content=content,
        metadata=metadata,
    )


@router.get("/{message_id}", summary="Get a message")
async def get_message_route(message_id: str):
    """Get a specific message by ID."""
    message = get_message(message_id)
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    return message


@router.get("/thread/{thread_id}", summary="List messages in a thread")
async def list_messages_route(thread_id: str, limit: int | None = None):
    """List all messages in a thread, ordered by creation time."""
    return list_messages(thread_id, limit=limit)


@router.delete("/{message_id}", summary="Delete a message")
async def delete_message_route(message_id: str):
    """Delete a message."""
    result = delete_message(message_id)
    if "not found" in result:
        raise HTTPException(status_code=404, detail=result)
    return {"message": result}


@router.delete("/thread/{thread_id}", summary="Delete all messages in a thread")
async def delete_thread_messages_route(thread_id: str):
    """Delete all messages in a thread."""
    result = delete_thread_messages(thread_id)
    return {"message": result}
