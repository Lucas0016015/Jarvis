"""Dynamic tool selection for Jarvis to optimize context window."""
from backend.tools.web_search import web_search
from backend.tools.wiki import wiki_query, wiki_ingest, wiki_save_research
from backend.tools.notes import create_note, list_notes
from backend.tools.todos import create_todo, list_todos
from backend.tools.calendar import list_calendar_events, create_calendar_event
from backend.tools.email import search_emails, send_email

# Grupos lógicos de herramientas
TOOL_GROUPS = {
    "research": [web_search, wiki_query, wiki_save_research, wiki_ingest],
    "productivity": [create_note, list_notes, create_todo, list_todos, list_calendar_events, create_calendar_event],
    "communication": [search_emails, send_email]
}

def get_relevant_tools(user_input: str) -> list:
    """Selecciona dinámicamente qué herramientas cargar basado en palabras clave."""
    input_lower = user_input.lower()
    selected = []

    # Usamos una lista y verificamos duplicados para evitar el error de 'unhashable'
    if any(word in input_lower for word in ["investiga", "busca", "qué es", "quién es", "wiki", "notas", "aprende", "guarda"]):
        for tool in TOOL_GROUPS["research"]:
            if tool not in selected:
                selected.append(tool)
    
    if any(word in input_lower for word in ["tarea", "todo", "recordatorio", "nota", "calendario", "evento", "reunión"]):
        for tool in TOOL_GROUPS["productivity"]:
            if tool not in selected:
                selected.append(tool)
        
    if any(word in input_lower for word in ["correo", "email", "mensaje", "escribe a"]):
        for tool in TOOL_GROUPS["communication"]:
            if tool not in selected:
                selected.append(tool)

    # Si no hay coincidencia clara, cargamos un set base (Wiki + Web)
    if not selected:
        return [wiki_query, web_search]
    
    return selected
