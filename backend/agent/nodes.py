"""LangGraph nodes for the Jarvis agent — with circuit breaker protection.

Architecture:
    SystemMessage (persona prompt) → first message in every LLM call
    _trim_messages → respects settings.max_context_messages
    llm_breaker → circuit breaker on all LLM invocations
"""
from typing import Any
from langchain_core.messages import SystemMessage, HumanMessage
from loguru import logger

from backend.agent.state import JarvisState
from backend.agent.personalities import get_persona
from backend.config import settings
from backend.core.resilience import llm_breaker


def _get_persona_prompt(persona: str) -> str:
    return get_persona(persona).system_prompt


def _trim_messages(messages: list, persona: str = "profesional"):
    """Keep SystemMessage + last N messages (respects MAX_CONTEXT_MESSAGES)."""
    max_messages = getattr(settings, "max_context_messages", 30)
    if len(messages) <= max_messages:
        return messages
    system_msg = [m for m in messages if isinstance(m, SystemMessage)]
    other = [m for m in messages if not isinstance(m, SystemMessage)]
    keep = max_messages - len(system_msg)
    return system_msg + other[-keep:]


def call_model(state: JarvisState) -> dict:
    """Invoke LLM without tools — protected by circuit breaker."""
    from backend.llm import get_llm
    llm = get_llm()
    persona = state.get("persona", "profesional")
    system = SystemMessage(content=_get_persona_prompt(persona))
    messages = [system] + state["messages"]
    trimmed = _trim_messages(messages, persona)
    response = llm_breaker.call(llm.invoke, trimmed)
    return {"messages": [response]}


def call_model_with_tools(
    state: JarvisState, llm_with_tools, extra_context: str = "",
) -> dict:
    """Invoke LLM with bound tools + RAG context — circuit breaker protected.

    Flow: SystemMessage(persona) → history → RAG context → trim → LLM.invoke()
    Falls back to plain invoke if the model does not support tools.
    """
    persona = state.get("persona", "profesional")
    base = list(state["messages"])

    if extra_context and base:
        ctx = HumanMessage(content=(
            "[INFORMACIÓN RELEVANTE DE TU MEMORIA EXTERNA]\n" + extra_context
        ))
        enriched = base[:-1] + [ctx, base[-1]]
    else:
        enriched = base

    system = SystemMessage(content=_get_persona_prompt(persona))
    messages = [system] + enriched
    trimmed = _trim_messages(messages, persona)

    try:
        response = llm_breaker.call(llm_with_tools.invoke, trimmed)
    except Exception as e:
        err_msg = str(e)
        if "does not support tools" in err_msg or "status code: 400" in err_msg:
            logger.warning(f"Model no soporta tools, usando invoke sin tool binding: {err_msg[:120]}")
            from backend.llm import get_llm
            llm = get_llm()
            response = llm_breaker.call(llm.invoke, trimmed)
        else:
            raise

    return {"messages": [response]}
