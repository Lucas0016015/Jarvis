"""Wiki tools — Obsidian-powered knowledge base (PRO version)."""
from langchain_core.tools import tool
from pathlib import Path
import os
import sys

# Asegurar que el path sea correcto para importar librarian
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from dotenv import load_dotenv
load_dotenv()

_librarian = None

def _get_librarian():
    global _librarian
    if _librarian is None:
        from librarian import Librarian
        data_dir = os.getenv("DATA_DIR", "data")
        _librarian = Librarian(base_path=data_dir)
    return _librarian

@tool
def wiki_query(query: str) -> str:
    """Busca en tu cerebro local (Obsidian). Úsala para recordar notas o proyectos previos."""
    lib = _get_librarian()
    return lib.query_knowledge(query)

@tool
def wiki_save_research(title: str, content: str) -> str:
    """Guarda investigación en la wiki. Crea un archivo .md, actualiza el índice y el log.
    Usa [[wikilinks]] para conectar con otros temas."""
    lib = _get_librarian()
    
    # Sanitizar título
    safe_title = "".join(c for c in title if c.isalnum() or c in " _-").strip().replace(" ", "_")
    
    # 1. Guardar en sources
    source_path = lib.engine.sources_path / f"{safe_title}.md"
    source_path.parent.mkdir(parents=True, exist_ok=True)
    source_path.write_text(f"# {title}\n\n{content}", encoding="utf-8")
    
    # 2. Ingestar (esto crea las páginas en wiki/, actualiza index.md y log.md)
    print(f"Librarian: Procesando y guardando '{title}' en el cerebro...")
    lib.ingest_source(source_path)
    
    return f"Conocimiento '{title}' integrado exitosamente. Archivo creado, índice actualizado y acción registrada en log.md."

@tool
def wiki_ingest(file_name: str) -> str:
    """Procesa un archivo .md existente en sources y lo integra en la wiki."""
    lib = _get_librarian()
    source_path = lib.engine.sources_path / file_name
    if not source_path.exists():
        return f"Error: No se encontró {file_name} en data/sources/."
    
    lib.ingest_source(source_path)
    return f"Archivo {file_name} procesado e integrado."

@tool
def shopping_list_add(item: str, category: str = "general") -> str:
    """Agrega un item a la lista de compras. Se guarda como nota taggeada."""
    from backend.tools.notes import create_note
    create_note.invoke({
        "title": f"Comprar: {item}",
        "content": f"Item: {item}\nCategoria: {category}",
        "tags": ["shopping", category]
    })
    return f"'{item}' agregado a la lista de compras."

@tool
def shopping_list_view() -> str:
    """Ver items en la lista de compras."""
    from backend.tools.notes import list_notes
    return list_notes.invoke({"tag": "shopping"})
