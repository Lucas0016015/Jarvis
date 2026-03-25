"""Business logic for to-do management."""
from typing import Literal

from backend.models.todo import Todo
from backend.storage.json_store import JsonStore

_store = JsonStore("todos")


def create_todo(text: str, priority: Literal["low", "medium", "high"] = "medium", due_date: str | None = None) -> dict:
    from datetime import datetime
    todo = Todo(
        text=text,
        priority=priority,
        due_date=datetime.fromisoformat(due_date) if due_date else None,
    )
    _store.set(todo.id, todo.model_dump())
    return todo.model_dump()


def list_todos(show_completed: bool = False) -> list[dict]:
    todos = [Todo(**t) for t in _store.all()]
    if not show_completed:
        todos = [t for t in todos if not t.completed]
    return [t.model_dump() for t in todos]


def get_todo(todo_id: str) -> dict | None:
    return _store.get(todo_id)


def complete_todo(todo_id: str) -> dict | None:
    data = _store.get(todo_id)
    if not data:
        return None
    todo = Todo(**data)
    todo.completed = True
    _store.set(todo.id, todo.model_dump())
    return todo.model_dump()


def delete_todo(todo_id: str) -> str:
    deleted = _store.delete(todo_id)
    return f"Todo {todo_id} deleted." if deleted else f"Todo {todo_id} not found."
