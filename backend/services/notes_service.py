"""Business logic for note management."""
from datetime import datetime, timezone

from backend.models.note import Note
from backend.storage.json_store import JsonStore

_store = JsonStore("notes")


def create_note(title: str, content: str, tags: list[str] | None = None) -> dict:
    note = Note(title=title, content=content, tags=tags or [])
    _store.set(note.id, note.model_dump())
    return note.model_dump()


def list_notes(tag: str | None = None) -> list[dict]:
    notes = [Note(**n) for n in _store.all()]
    if tag:
        notes = [n for n in notes if tag in n.tags]
    return [n.model_dump() for n in notes]


def get_note(note_id: str) -> dict | None:
    return _store.get(note_id)


def update_note(note_id: str, title: str | None = None, content: str | None = None, tags: list[str] | None = None) -> dict | None:
    data = _store.get(note_id)
    if not data:
        return None
    note = Note(**data)
    if title is not None:
        note.title = title
    if content is not None:
        note.content = content
    if tags is not None:
        note.tags = tags
    note.updated_at = datetime.now(timezone.utc)
    _store.set(note.id, note.model_dump())
    return note.model_dump()


def delete_note(note_id: str) -> str:
    deleted = _store.delete(note_id)
    return f"Note {note_id} deleted." if deleted else f"Note {note_id} not found."
