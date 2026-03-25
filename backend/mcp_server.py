"""
Jarvis MCP Server — exposes all tools via the Model Context Protocol.

Run standalone (stdio transport, for Claude Desktop):
    python -m backend.mcp_server

Dev mode (interactive inspector):
    mcp dev backend/mcp_server.py
"""
from typing import Literal
from mcp.server.fastmcp import FastMCP

from backend.services import notes_service, todos_service, calendar_service, email_service

mcp = FastMCP("Jarvis")


# ── Notes (5 tools) ──────────────────────────────────────────────────────────

@mcp.tool()
def create_note(title: str, content: str, tags: list[str] | None = None) -> dict:
    """Create a new note with a title, content, and optional tags. Returns the created note."""
    return notes_service.create_note(title, content, tags)


@mcp.tool()
def list_notes(tag: str | None = None) -> list[dict]:
    """List all notes, optionally filtered by tag."""
    return notes_service.list_notes(tag)


@mcp.tool()
def get_note(note_id: str) -> dict | None:
    """Get a specific note by its ID."""
    return notes_service.get_note(note_id)


@mcp.tool()
def update_note(note_id: str, title: str | None = None, content: str | None = None, tags: list[str] | None = None) -> dict | None:
    """Update an existing note's title, content, or tags."""
    return notes_service.update_note(note_id, title, content, tags)


@mcp.tool()
def delete_note(note_id: str) -> str:
    """Delete a note by its ID. Returns a confirmation message."""
    return notes_service.delete_note(note_id)


# ── Todos (4 tools) ──────────────────────────────────────────────────────────

@mcp.tool()
def create_todo(text: str, priority: Literal["low", "medium", "high"] = "medium", due_date: str | None = None) -> dict:
    """Create a new to-do item. due_date should be ISO format string (e.g. 2024-12-31T10:00:00)."""
    return todos_service.create_todo(text, priority, due_date)


@mcp.tool()
def list_todos(show_completed: bool = False) -> list[dict]:
    """List to-do items. By default only shows incomplete items."""
    return todos_service.list_todos(show_completed)


@mcp.tool()
def complete_todo(todo_id: str) -> dict | None:
    """Mark a to-do item as completed."""
    return todos_service.complete_todo(todo_id)


@mcp.tool()
def delete_todo(todo_id: str) -> str:
    """Delete a to-do item by its ID."""
    return todos_service.delete_todo(todo_id)


# ── Calendar (5 tools) ───────────────────────────────────────────────────────

@mcp.tool()
def create_calendar_event(
    title: str,
    start_datetime: str,
    end_datetime: str,
    description: str = "",
    location: str = "",
    calendar_id: str = "primary",
) -> dict:
    """Create a calendar event. Datetimes must be ISO format (e.g. 2024-12-31T10:00:00)."""
    return calendar_service.create_calendar_event(title, start_datetime, end_datetime, description, location, calendar_id)


@mcp.tool()
def list_calendar_events(upcoming_only: bool = True, calendar_id: str = "primary") -> list[dict]:
    """List calendar events. By default only shows upcoming events."""
    return calendar_service.list_calendar_events(upcoming_only, calendar_id)


@mcp.tool()
def get_calendar_event(event_id: str, calendar_id: str = "primary") -> dict | None:
    """Get a calendar event by its ID."""
    return calendar_service.get_calendar_event(event_id, calendar_id)


@mcp.tool()
def update_calendar_event(
    event_id: str,
    title: str | None = None,
    start_datetime: str | None = None,
    end_datetime: str | None = None,
    description: str | None = None,
    location: str | None = None,
    calendar_id: str = "primary",
) -> dict | None:
    """Update an existing calendar event's fields."""
    return calendar_service.update_calendar_event(event_id, title, start_datetime, end_datetime, description, location, calendar_id)


@mcp.tool()
def delete_calendar_event(event_id: str, calendar_id: str = "primary") -> str:
    """Delete a calendar event by its ID."""
    return calendar_service.delete_calendar_event(event_id, calendar_id)


# ── Email (4 tools) ──────────────────────────────────────────────────────────

@mcp.tool()
def list_emails(max_results: int = 10, label: str = "INBOX") -> list[dict]:
    """List recent emails from a Gmail label. Returns sender, subject, snippet, and message ID."""
    return email_service.list_emails(max_results, label)


@mcp.tool()
def get_email(message_id: str) -> dict:
    """Get the full content of an email by its message ID."""
    return email_service.get_email(message_id)


@mcp.tool()
def send_email(to: str, subject: str, body: str) -> str:
    """Send an email to the specified recipient."""
    return email_service.send_email(to, subject, body)


@mcp.tool()
def search_emails(query: str, max_results: int = 10) -> list[dict]:
    """Search emails using Gmail search syntax (e.g., 'from:boss@company.com is:unread')."""
    return email_service.search_emails(query, max_results)


if __name__ == "__main__":
    mcp.run()  # stdio transport by default
