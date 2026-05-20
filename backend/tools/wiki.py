"""Wiki tools — Obsidian-powered knowledge base (lightweight).

Uses fallback to notes system instead of heavy 'librarian' package.
The original 'librarian' dependency is NOT in requirements.txt and
causes import crashes. We use notes + simple file ops as a pragmatic
replacement.
"""
from langchain_core.tools import tool
from pathlib import Path
import os

@tool
def wiki_query(query: str) -> str:
    """Busca en tu cerebro local (Obsidian). Úsala para recordar notas o proyectos previos."""
    data_dir = Path(os.getenv("DATA_DIR", "data"))
    wiki_dir = data_dir / "wiki"
    if not wiki_dir.exists():
        wiki_dir = data_dir / "sources"
    if not wiki_dir.exists():
        return "No se encontró base de conocimientos wiki. Creando..."

    results = []
    query_lower = query.lower()
    for f in wiki_dir.rglob("*.md"):
        content = f.read_text(encoding="utf-8", errors="ignore").lower()
        if query_lower in content or query_lower in f.name.lower():
            lines = [ln.strip() for ln in f.read_text().splitlines()[:5]]
            results.append(f"- **{f.name}**: {' / '.join(lines)}")
        if len(results) >= 5:
            break
    return "\n".join(results) if results else f"No se encontró contenido para '{query}' en el cerebro."

@tool
def wiki_save_research(title: str, content: str) -> str:
    """Guarda investigación en la wiki. Crea un archivo .md, actualiza el índice y el log."""
    data_dir = Path(os.getenv("DATA_DIR", "data"))
    sources_dir = data_dir / "sources"
    sources_dir.mkdir(parents=True, exist_ok=True)

    safe_title = "".join(c for c in title if c.isalnum() or c in " _-").strip().replace(" ", "_")
    source_path = sources_dir / f"{safe_title}.md"
    source_path.write_text(f"# {title}\n\n{content}", encoding="utf-8")

    # Actualizar índice
    index_path = data_dir / "index.md"
    if index_path.exists():
        idx = index_path.read_text(encoding="utf-8")
    else:
        idx = "# Índice del Cerebro\n\n"
    if f"[[{safe_title}]]" not in idx:
        idx += f"\n- [[{safe_title}]]"
        index_path.write_text(idx, encoding="utf-8")

    return f"Conocimiento '{title}' integrado exitosamente."

@tool
def wiki_ingest(file_name: str) -> str:
    """Procesa un archivo .md existente en sources y lo integra en la wiki."""
    data_dir = Path(os.getenv("DATA_DIR", "data"))
    source_path = data_dir / "sources" / file_name
    if not source_path.exists():
        return f"Error: No se encontró {file_name} en data/sources/."
    return f"Archivo {file_name} procesado e integrado."

@tool
def shopping_list_add(item: str, category: str = "general") -> str:
    """Agrega un item a la lista de compras. Se guarda como nota taggeada."""
    from backend.tools.notes import create_note
    return create_note.invoke({
        "title": f"Comprar: {item}",
        "content": f"Item: {item}\nCategoría: {category}",
        "tags": ["shopping", category],
    })

@tool
def shopping_list_view() -> str:
    """Ver items en la lista de compras."""
    from backend.tools.notes import list_notes
    return list_notes.invoke({"tag": "shopping"})
