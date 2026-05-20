"""Autonomous Graph with Dynamic Tool Pruning to fit local context limits + RAG retrieval."""
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import ToolNode, tools_condition

from backend.agent.state import JarvisState
from backend.agent.nodes import call_model_with_tools
from backend.agent.rag_node import retrieval_node
from backend.llm import get_llm
from backend.tools.registry import ALL_TOOLS, CORE_TOOLS, EXTENDED_TOOLS
from backend.agent.personalities import get_persona

# ── Checkpointer ─────────────────────────────────────────────
import os
os.makedirs("data", exist_ok=True)
try:
    from langgraph.checkpoint.memory import MemorySaver
    CHECKPOINTER = MemorySaver()
    print("[checkpointer] MemorySaver (volátil)")
except Exception as e:
    from langgraph.checkpoint.memory import MemorySaver
    CHECKPOINTER = MemorySaver()
    print(f"[checkpointer] MemorySaver fallback — {e}")

checkpointer = CHECKPOINTER


def get_contextual_tools(input_text: str) -> list:
    """
    Selecciona herramientas basadas en el contexto para ahorrar tokens.
    Esto permite que el modelo 'piense' con un set de herramientas manejable.
    """
    input_text = input_text.lower()
    tools = list(CORE_TOOLS)

    if any(word in input_text for word in ["correo", "email", "escribe", "enviar"]):
        tools.extend([t for t in EXTENDED_TOOLS if "email" in str(t.name)])

    if any(word in input_text for word in ["calendario", "reunión", "evento", "cita"]):
        tools.extend([t for t in EXTENDED_TOOLS if "calendar" in str(t.name)])

    return tools


def build_autonomous_graph(tools=None):
    builder = StateGraph(JarvisState)

    active_tools = tools if tools is not None else ALL_TOOLS

    def dynamic_agent_node(state: JarvisState):
        last_msg = state["messages"][-1].content if state["messages"] else ""
        persona = state.get("persona", "profesional")

        from backend.agent.personalities import get_persona as gp
        persona_config = gp(persona)
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
    builder.add_node("tools", ToolNode(active_tools))

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
