"""Business logic for Google Calendar integration."""
from __future__ import annotations
import os
from datetime import datetime, timezone
from backend.config import settings

SCOPES = ["https://www.googleapis.com/auth/calendar"]


def _get_calendar_service():
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from google.auth.transport.requests import Request
    from googleapiclient.discovery import build

    creds = None
    token_file = settings.gcal_token_file
    credentials_file = settings.gmail_credentials_file  # reuse same credentials file

    if token_file and os.path.exists(token_file):
        creds = Credentials.from_authorized_user_file(token_file, SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        elif credentials_file:
            flow = InstalledAppFlow.from_client_secrets_file(credentials_file, SCOPES)
            creds = flow.run_local_server(port=0)
        else:
            raise RuntimeError("Google Calendar credentials not configured.")
        if token_file:
            with open(token_file, "w") as f:
                f.write(creds.to_json())

    return build("calendar", "v3", credentials=creds)


def _normalize_event(e: dict) -> dict:
    """Normalize a Google Calendar event to our internal shape."""
    start = e.get("start", {})
    end = e.get("end", {})
    return {
        "id": e["id"],
        "title": e.get("summary", ""),
        "start_datetime": start.get("dateTime", start.get("date", "")),
        "end_datetime": end.get("dateTime", end.get("date", "")),
        "description": e.get("description", ""),
        "location": e.get("location", ""),
    }


def create_calendar_event(
    title: str,
    start_datetime: str,
    end_datetime: str,
    description: str = "",
    location: str = "",
    calendar_id: str = "primary",
) -> dict:
    service = _get_calendar_service()
    body = {
        "summary": title,
        "description": description,
        "location": location,
        "start": {"dateTime": start_datetime, "timeZone": "UTC"},
        "end": {"dateTime": end_datetime, "timeZone": "UTC"},
    }
    event = service.events().insert(calendarId=calendar_id, body=body).execute()
    return _normalize_event(event)


def list_calendar_events(
    upcoming_only: bool = True, calendar_id: str = "primary", max_results: int = 50
) -> list[dict]:
    service = _get_calendar_service()
    kwargs = {
        "calendarId": calendar_id,
        "singleEvents": True,
        "orderBy": "startTime",
        "maxResults": max_results,
    }
    if upcoming_only:
        kwargs["timeMin"] = datetime.now(timezone.utc).isoformat()
    events = service.events().list(**kwargs).execute()
    return [_normalize_event(e) for e in events.get("items", [])]


def get_calendar_event(event_id: str, calendar_id: str = "primary") -> dict | None:
    service = _get_calendar_service()
    try:
        event = service.events().get(calendarId=calendar_id, eventId=event_id).execute()
        return _normalize_event(event)
    except Exception:
        return None


def update_calendar_event(
    event_id: str,
    title: str | None = None,
    start_datetime: str | None = None,
    end_datetime: str | None = None,
    description: str | None = None,
    location: str | None = None,
    calendar_id: str = "primary",
) -> dict | None:
    service = _get_calendar_service()
    try:
        event = service.events().get(calendarId=calendar_id, eventId=event_id).execute()
    except Exception:
        return None
    if title is not None:
        event["summary"] = title
    if description is not None:
        event["description"] = description
    if location is not None:
        event["location"] = location
    if start_datetime is not None:
        event["start"] = {"dateTime": start_datetime, "timeZone": "UTC"}
    if end_datetime is not None:
        event["end"] = {"dateTime": end_datetime, "timeZone": "UTC"}
    updated = service.events().update(calendarId=calendar_id, eventId=event_id, body=event).execute()
    return _normalize_event(updated)


def delete_calendar_event(event_id: str, calendar_id: str = "primary") -> str:
    service = _get_calendar_service()
    try:
        service.events().delete(calendarId=calendar_id, eventId=event_id).execute()
        return f"Event {event_id} deleted."
    except Exception:
        return f"Event {event_id} not found."
