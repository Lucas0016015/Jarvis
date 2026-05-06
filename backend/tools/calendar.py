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
) -> str:
    """Create a calendar event. Datetimes must be ISO format (e.g. 2024-12-31T10:00:00)."""
    try:
        event = calendar_service.create_calendar_event(title, start_datetime, end_datetime, description, location, calendar_id)
        return f"Event created successfully: {event.get('id')}"
    except Exception as e:
        return f"Error creating calendar event: {str(e)}"


@tool
def list_calendar_events(upcoming_only: bool = True, calendar_id: str = "primary") -> str:
    """List calendar events. By default only shows upcoming events."""
    try:
        events = calendar_service.list_calendar_events(upcoming_only, calendar_id)
        return str(events)
    except Exception as e:
        return f"Error listing calendar events: {str(e)}"


@tool
def get_calendar_event(event_id: str, calendar_id: str = "primary") -> str:
    """Get a calendar event by its ID."""
    try:
        event = calendar_service.get_calendar_event(event_id, calendar_id)
        return str(event) if event else "Event not found."
    except Exception as e:
        return f"Error getting calendar event: {str(e)}"


@tool
def update_calendar_event(
    event_id: str,
    title: str | None = None,
    start_datetime: str | None = None,
    end_datetime: str | None = None,
    description: str | None = None,
    location: str | None = None,
    calendar_id: str = "primary",
) -> str:
    """Update an existing calendar event's fields."""
    try:
        event = calendar_service.update_calendar_event(event_id, title, start_datetime, end_datetime, description, location, calendar_id)
        return f"Event updated: {event.get('id')}" if event else "Event not found."
    except Exception as e:
        return f"Error updating calendar event: {str(e)}"


@tool
def delete_calendar_event(event_id: str, calendar_id: str = "primary") -> str:
    """Delete a calendar event by its ID."""
    try:
        return calendar_service.delete_calendar_event(event_id, calendar_id)
    except Exception as e:
        return f"Error deleting calendar event: {str(e)}"
