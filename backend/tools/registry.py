"""Central tool registry with optimized descriptions and categorization."""
from backend.tools.notes import create_note, list_notes, get_note
from backend.tools.todos import create_todo, list_todos, complete_todo
from backend.tools.calendar import list_calendar_events, create_calendar_event
from backend.tools.email import search_emails, send_email
from backend.tools.wiki import wiki_query, wiki_save_research, wiki_ingest
from backend.tools.utility import get_current_time

# Web search — lazy import (playwright may be missing).
try:
    from backend.tools.web_search import web_search
    _WEB_SEARCH_AVAILABLE = True
except Exception:
    _WEB_SEARCH_AVAILABLE = False
    web_search = None  # type: ignore

# Semantic search — lazy import (langchain_chroma may be missing).
try:
    from backend.tools.semantic_search import (
        search_notes_semantic,
        search_wiki_semantic,
        search_all_knowledge,
        get_knowledge_stats,
    )
    _SEMANTIC_AVAILABLE = True
except Exception:
    _SEMANTIC_AVAILABLE = False
    search_notes_semantic = None  # type: ignore
    search_wiki_semantic = None   # type: ignore
    search_all_knowledge = None   # type: ignore
    get_knowledge_stats = None    # type: ignore

_CORE_TOOLS = [
    wiki_query,
    wiki_save_research,
    list_notes,
    create_note,
    list_todos,
    create_todo,
    complete_todo,
    get_current_time,
]

if _WEB_SEARCH_AVAILABLE and web_search is not None:
    _CORE_TOOLS.append(web_search)

if _SEMANTIC_AVAILABLE:
    _CORE_TOOLS += [
        search_notes_semantic,
        search_wiki_semantic,
        search_all_knowledge,
        get_knowledge_stats,
    ]

CORE_TOOLS = _CORE_TOOLS

# Herramientas especializadas (solo si es necesario)
_EXTENDED_TOOLS = [
    list_calendar_events,
    create_calendar_event,
    search_emails,
    send_email,
    wiki_ingest,
]

if _WEB_SEARCH_AVAILABLE and web_search is not None:
    _EXTENDED_TOOLS.append(web_search)

EXTENDED_TOOLS = _EXTENDED_TOOLS

ALL_TOOLS = CORE_TOOLS + EXTENDED_TOOLS
