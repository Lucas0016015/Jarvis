"""JarvisState extends MessagesState with session metadata."""
from typing import Annotated
import operator
from langgraph.graph import MessagesState


class JarvisState(MessagesState):
    """Extends MessagesState with user/session tracking and RAG context."""
    user_id: str | None = None
    session_id: str | None = None
    persona: str = "default"
    retrieved_context: Annotated[list[str], operator.add] = []
