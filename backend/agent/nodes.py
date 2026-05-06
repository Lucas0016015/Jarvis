"""LangGraph nodes for the Jarvis agent."""
from typing import Any
from langchain_core.messages import SystemMessage, HumanMessage

from backend.agent.state import JarvisState
from backend.agent.prompts import SYSTEM_PROMPT
from backend.agent.personalities import get_persona
from backend.llm import get_llm


def _get_persona_prompt(persona: str) -> str:
    """Get system prompt for the active persona."""
    return get_persona(persona).system_prompt


def _trim_messages(messages: list, max_messages: int = 6):
    """Conserva el SystemMessage (si existe) y los últimos N mensajes."""
    if len(messages) <= max_messages:
        return messages

    from langchain_core.messages import SystemMessage
    system_msg = [m for m in messages if isinstance(m, SystemMessage)]

    other_messages = [m for m in messages if not isinstance(m, SystemMessage)]
    trimmed = other_messages[-(max_messages - 1):]

    return system_msg + trimmed


def _get_filtered_tools(persona: str, all_tools: list):
    """Filter tools based on persona allowed_tools."""
    persona_config = get_persona(persona)
    allowed = set(persona_config.allowed_tools)
    return [t for t in all_tools if t.name in allowed]


def call_model(state: JarvisState) -> dict:
    """Invoke the LLM with the current message history."""
    llm = get_llm()
    persona = state.get("persona", "default")
    system = SystemMessage(content=_get_persona_prompt(persona))
    messages = [system] + state["messages"]
    trimmed_messages = _trim_messages(messages)
    response = llm.invoke(trimmed_messages)
    return {"messages": [response]}


def call_model_with_tools(state: JarvisState, llm_with_tools, extra_context: str = "") -> dict:
    """Invoke the LLM (with bound tools) with the current message history and optional RAG context."""
    persona = state.get("persona", "default")
    base_messages = state["messages"]

    if extra_context:
        context_msg = HumanMessage(
            content=(
                "[El agente ha recuperado información relevante de tu memoria externa. "
                "USÁ ESTA INFORMACIÓN para responder si es pertinente.]\n\n"
                + extra_context
            )
        )
        enriched_messages = [context_msg] + base_messages
    else:
        enriched_messages = base_messages

    system = SystemMessage(content=_get_persona_prompt(persona))
    messages = [system] + enriched_messages
    trimmed_messages = _trim_messages(messages)
    response = llm_with_tools.invoke(trimmed_messages)
    return {"messages": [response]}
