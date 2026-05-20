"""Ollama Cloud LLM — uses ChatOpenAI for Ollama Cloud's OpenAI-compatible API.

Ollama Cloud (https://ollama.com) exposes an OpenAI-compatible endpoint
at /v1/chat/completions, just like local Ollama. We use ChatOpenAI
with the cloud base_url and API key for authentication.
"""
from langchain_openai import ChatOpenAI
from langchain_core.language_models import BaseChatModel
from backend.config import settings


def get_llm() -> BaseChatModel:
    return ChatOpenAI(
        model=settings.ollama_model,
        api_key=settings.ollama_api_key,
        base_url=f"{settings.ollama_base_url.rstrip('/')}/v1",
        temperature=0.7,
        streaming=True,
        max_tokens=2048,
    )
