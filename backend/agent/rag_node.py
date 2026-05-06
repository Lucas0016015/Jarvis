"""RAG retrieval node for the Jarvis agent — automatically searches knowledge when relevant."""
import re
from backend.agent.state import JarvisState

try:
    from backend.service.vector_service import semantic_search
except ImportError:
    semantic_search = None


RAG_TRIGGER_PATTERNS = [
    r"qué (tenés|tienes|sabes|recuerdas|hice|hacemos|decidimos|hablamos)",
    r"busca(r|me)? (en |en mi )?(notas|wiki|conocimiento|cerebro)",
    r"tenés.*nota",
    r"exist(e|a).*nota",
    r"qué (hay|tenemos).*(nota|wiki|conocimiento)",
    r"recordame?.*",
    r"busca.*sobre",
    r"encontre",
    r"no recuerdo",
    r"dóndeguard",
    r"¿qué (tenés|tienes|sabes|recuerdas|hice|hacemos|decidimos|hablamos)",
    r"¿busca(r|me)?",
    r"¿tenés.*nota",
    r"¿exist(e|a).*nota",
    r"¿qué (hay|tenemos).*(nota|wiki|conocimiento)",
    r"¿recordame?",
    r"¿busca.*sobre",
    r"¿encontre",
    r"¿no recuerdo",
    r"¿dóndeguard",
    r"búsqueda",
    r"tenía.*nota",
    r"había.*nota",
    r"guardé.*nota",
    r"creé.*nota",
    r"escribí.*nota",
    r"busqué.*nota",
    r"encontre.*nota",
    r"saben.*sobre",
    r"sabés.*sobre",
]


def _should_retrieve(query: str) -> bool:
    """Determine if the query warrants a RAG retrieval."""
    query_lower = query.lower()
    for pattern in RAG_TRIGGER_PATTERNS:
        if re.search(pattern, query_lower):
            return True
    return False


def _build_context_string(results: list[dict], source_label: str) -> str:
    """Format retrieval results into a context string."""
    if not results:
        return ""
    lines = [f"\n## {source_label}\n"]
    seen_titles = set()
    for r in results:
        title = r.get("title", "Unknown")
        if title in seen_titles:
            continue
        seen_titles.add(title)
        similarity_pct = round((1 - r.get("score", 1.0)) * 100, 1)
        content = r.get("content", "")
        lines.append(f"\n**{title}** (similitud: {similarity_pct}%)\n{content[:500]}")
    return "\n".join(lines)


def retrieval_node(state: JarvisState) -> dict:
    """
    RAG node: automatically searches the vector store when the query
    seems to need knowledge/context from notes or wiki.
    Appends retrieved context to state['retrieved_context'].
    """
    last_msg = state["messages"][-1].content if state["messages"] else ""

    if not _should_retrieve(last_msg) or semantic_search is None:
        return {"retrieved_context": []}

    results = semantic_search(last_msg, top_k=5, source_filter=None)

    if not results:
        return {"retrieved_context": []}

    by_source = {"notes": [], "wiki": []}
    for r in results:
        src = r.get("source", "unknown")
        if src in by_source:
            by_source[src].append(r)
        else:
            by_source["notes"].append(r)

    context_parts = []
    if by_source["notes"]:
        context_parts.append(_build_context_string(by_source["notes"], "📝 NOTAS PERSONALES"))
    if by_source["wiki"]:
        context_parts.append(_build_context_string(by_source["wiki"], "🧠 WIKI / CONOCIMIENTO"))

    full_context = "\n\n---\n\n".join(context_parts) if context_parts else ""

    return {"retrieved_context": [full_context] if full_context else []}
