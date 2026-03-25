"""LangChain tools for Gmail integration via Google API."""
from langchain_core.tools import tool

from backend.services import email_service


@tool
def list_emails(max_results: int = 10, label: str = "INBOX") -> list[dict]:
    """List recent emails from a Gmail label. Returns sender, subject, snippet, and message ID."""
    return email_service.list_emails(max_results, label)


@tool
def get_email(message_id: str) -> dict:
    """Get the full content of an email by its message ID."""
    return email_service.get_email(message_id)


@tool
def send_email(to: str, subject: str, body: str) -> str:
    """Send an email to the specified recipient."""
    return email_service.send_email(to, subject, body)


@tool
def search_emails(query: str, max_results: int = 10) -> list[dict]:
    """Search emails using Gmail search syntax (e.g., 'from:boss@company.com is:unread')."""
    return email_service.search_emails(query, max_results)
