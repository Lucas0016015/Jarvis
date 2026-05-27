"""Autonomous Graph — sin dependencia de langgraph.prebuilt para evitar
ImportError en Railway (ExecutionInfo)."""
from typing import Literal
from langgraph.graph import StateGraph, START, END
from langchain_core.messages import AIMessage, ToolMessage
from langchain_core.tools import BaseTool

from backend.agent.state import JarvisState
from backend.agent.nodes import call_model_with_tools
from backend.agent.rag_node import retrieval_node
from backend.llm import get_llm
from backend.tools.registry import ALL_TOOLS, CORE_TOOLS, EXTENDED_TOOLS
from backend.agent.personalities import get_persona

import os
os.makedirs("data", exist_ok=True)
from langgraph.checkpoint.memory import MemorySaver
CHECKPOINTER = MemorySaver()
checkpointer = CHECKPOINTER


def tools_condition(state: JarvisState) -> Literal["tools", "__end__"]:
    """Si el ultimo mensaje tiene tool_calls, seguir a tools. Si no, END."""
    messages = state["messages"]
    if not messages:
        return "__end__"
    last = messages[-1]
    if hasattr(last, "tool_calls") and last.tool_calls:
        return "tools"
    return "__end__"


def _tool_node_impl(state: JarvisState, tools: list[BaseTool]) -> dict:
    """Ejecuta tool calls del ultimo mensaje y devuelve ToolMessages."""
    messages = state["messages"]
    last = messages[-1]
    tool_map = {t.name: t for t in tools}
    result_messages = []
    for tc in last.tool_calls:
        tool = tool_map.get(tc["name"])
        if tool:
            try:
                output = tool.invoke(tc["args"])
                result_messages.append(ToolMessage(
                    content=str(output),
                    tool_call_id=tc["id"],
                    name=tc["name"],
                ))
            except Exception as e:
                result_messages.append(ToolMessage(
                    content=f"Error: {e}",
                    tool_call_id=tc["id"],
                    name=tc["name"],
                ))
    return {"messages": result_messages}


def get_contextual_tools(input_text: str) -> list:
    input_text = input_text.lower()
    tools = list(CORE_TOOLS)
    if any(word in input_text for word in ["correo", "email", "escribe", "enviar"]):
        tools.extend([t for t in EXTENDED_TOOLS if "email" in str(t.name)])
    if any(word in input_text for word in ["calendario", "reunión", "evento", "cita"]):
        tools.extend([t for t in EXTENDED_TOOLS if "calendar" in str(t.name)])
    return tools


def build_autonomous_graph(tools=None):
    active_tools = tools if tools is not None else ALL_TOOLS
    builder = StateGraph(JarvisState)

    def tool_node_fn(state: JarvisState) -> dict:
        return _tool_node_impl(state, active_tools)

    def dynamic_agent_node(state: JarvisState):
        persona = state.get("persona", "profesional")
        persona_config = get_persona(persona)
        allowed_tool_names = set(persona_config.allowed_tools)
        relevant_tools = [t for t in active_tools if t.name in allowed_tool_names]

        retrieved = state.get("retrieved_context", [])
        context_note = ""
        if retrieved:
            context_note = (
                "\n\n[CONOCIMIENTO RELEVANTE OBTENIDO DE TU MEMORIA EXTERNA]\n"
                + "\n".join(retrieved)
                + "\n[/CONOCIMIENTO RELEVANTE]\n\n"
            )

        llm = get_llm()
        llm_with_tools = llm.bind_tools(relevant_tools)
        return call_model_with_tools(state, llm_with_tools=llm_with_tools, extra_context=context_note)

    builder.add_node("retrieval", retrieval_node)
    builder.add_node("agent", dynamic_agent_node)
    builder.add_node("tools", tool_node_fn)
    builder.add_edge(START, "retrieval")
    builder.add_edge("retrieval", "agent")
    builder.add_conditional_edges("agent", tools_condition)
    builder.add_edge("tools", "agent")

    return builder.compile(checkpointer=checkpointer)


_graph = None

def get_graph(tools=None):
    global _graph
    if _graph is None or tools is not None:
        _graph = build_autonomous_graph(tools=tools)
    return _graph
