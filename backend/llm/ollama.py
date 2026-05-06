"""Factory for Ollama LLM — ChatOllama via langchain-ollama."""
from langchain_core.language_models import BaseChatModel
from backend.config import settings

def get_llm() -> BaseChatModel:
    """Return an LLM instance configured for Ollama (local or cloud).

    Detects automatically if the configured base_url is Ollama Cloud
    (https://ollama.com/api) and falls back to ChatOpenAI for cloud,
    since ChatOllama is designed primarily for local Ollama servers.
    """
    base_url = settings.ollama_base_url.rstrip("/")
    is_cloud = "ollama.com" in base_url or base_url.startswith("https://")

    if is_cloud:
        # Ollama Cloud exposes an OpenAI-compatible API
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=settings.ollama_model,
            api_key=settings.ollama_api_key or "ollama",
            base_url=f"{base_url}/v1",
            temperature=0.7,
            streaming=True,
            max_tokens=2048,
        )

    # Local Ollama
    from langchain_ollama import ChatOllama
    return ChatOllama(
        model=settings.ollama_model,
        base_url=base_url,
        temperature=0.7,
        streaming=True,
    )
