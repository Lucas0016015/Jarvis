"""Ollama Cloud LLM — uses ChatOllama with Bearer token auth for cloud API."""
from langchain_ollama import ChatOllama
from backend.config import settings


def get_llm() -> ChatOllama:
    """Return a ChatOllama instance configured for Ollama Cloud.

    Uses client_kwargs to pass the Authorization header with Bearer token,
    as required by https://ollama.com API.
    """
    return ChatOllama(
        model=settings.ollama_model,
        base_url=settings.ollama_base_url.rstrip("/"),
        client_kwargs={
            "headers": {"Authorization": f"Bearer {settings.ollama_api_key}"}
        },
        temperature=0.7,
        streaming=True,
    )