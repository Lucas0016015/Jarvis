"""LangChain tools for calendar event management."""
from langchain_core.tools import tool

from backend.services import calendar_service


@tool
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


@tool
def list_calendar_events(upcoming_only: bool = True, calendar_id: str = "primary") -> list[dict]:
    """List calendar events. By default only shows upcoming events."""
    return calendar_service.list_calendar_events(upcoming_only, calendar_id)


@tool
def get_calendar_event(event_id: str, calendar_id: str = "primary") -> dict | None:
    """Get a calendar event by its ID."""
    return calendar_service.get_calendar_event(event_id, calendar_id)


@tool
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


@tool
def delete_calendar_event(event_id: str, calendar_id: str = "primary") -> str:
    """Delete a calendar event by its ID."""
    return calendar_service.delete_calendar_event(event_id, calendar_id)
