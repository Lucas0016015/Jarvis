"""Token counting and budgeting for LLM cost tracking."""
import json
from datetime import datetime
from pathlib import Path
from threading import Lock
from typing import Any

from backend.config import settings

TOKEN_LOG_DIR = Path(settings.data_dir) / "token_logs"
TOKEN_LOG_DIR.mkdir(parents=True, exist_ok=True)

TOKEN_LOG_FILE = TOKEN_LOG_DIR / "token_usage.jsonl"
_token_lock = Lock()


class TokenBudgetExceededError(Exception):
    """Raised when token budget is exceeded."""
    pass


class TokenCounter:
    """
    Track and budget token usage across sessions and users.

    Usage:
        counter = TokenCounter()
        counter.log_usage(session_id="abc", user_id="user1", tokens=1500, cost=0.015)
        stats = counter.get_session_stats("abc")
    """

    def __init__(self, max_tokens_per_session: int = 100_000,
                 max_cost_per_session: float = 1.0):
        self.max_tokens_per_session = max_tokens_per_session
        self.max_cost_per_session = max_cost_per_session

    def log_usage(
        self,
        session_id: str,
        user_id: str | None = None,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
        total_tokens: int = 0,
        cost: float = 0.0,
        model: str = "unknown",
        endpoint: str = "unknown",
    ) -> None:
        """Log a single token usage event."""
        usage = {
            "timestamp": datetime.utcnow().isoformat(),
            "session_id": session_id,
            "user_id": user_id,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": total_tokens or (prompt_tokens + completion_tokens),
            "cost_usd": cost,
            "model": model,
            "endpoint": endpoint,
        }

        # Check budget before logging
        self._check_budget(session_id, usage["total_tokens"], cost)

        # Append to JSONL log (thread-safe)
        with _token_lock:
            with open(TOKEN_LOG_FILE, "a") as f:
                f.write(json.dumps(usage, default=str) + "\n")

    def get_session_stats(self, session_id: str) -> dict[str, Any]:
        """Get token usage statistics for a session."""
        usages = self._load_session_usages(session_id)

        if not usages:
            return {
                "session_id": session_id,
                "total_tokens": 0,
                "total_cost": 0.0,
                "request_count": 0,
                "avg_tokens_per_request": 0,
            }

        total_tokens = sum(u["total_tokens"] for u in usages)
        total_cost = sum(u["cost_usd"] for u in usages)

        return {
            "session_id": session_id,
            "total_tokens": total_tokens,
            "total_cost": round(total_cost, 6),
            "request_count": len(usages),
            "avg_tokens_per_request": round(total_tokens / len(usages), 1),
            "budget_remaining_tokens": max(0, self.max_tokens_per_session - total_tokens),
            "budget_remaining_cost": round(max(0, self.max_cost_per_session - total_cost), 6),
        }

    def get_user_stats(self, user_id: str, days: int = 30) -> dict[str, Any]:
        """Get token usage statistics for a user over the last N days."""
        usages = self._load_user_usages(user_id, days)

        if not usages:
            return {"user_id": user_id, "total_tokens": 0, "total_cost": 0.0}

        return {
            "user_id": user_id,
            "total_tokens": sum(u["total_tokens"] for u in usages),
            "total_cost": round(sum(u["cost_usd"] for u in usages), 6),
            "request_count": len(usages),
        }

    def _check_budget(self, session_id: str, additional_tokens: int, additional_cost: float) -> None:
        """Check if adding more tokens would exceed budget."""
        stats = self.get_session_stats(session_id)

        if stats["total_tokens"] + additional_tokens > self.max_tokens_per_session:
            raise TokenBudgetExceededError(
                f"Session {session_id} would exceed token budget "
                f"({stats['total_tokens'] + additional_tokens} > {self.max_tokens_per_session})"
            )

        if stats["total_cost"] + additional_cost > self.max_cost_per_session:
            raise TokenBudgetExceededError(
                f"Session {session_id} would exceed cost budget "
                f"(${stats['total_cost'] + additional_cost:.4f} > ${self.max_cost_per_session:.2f})"
            )

    def _load_session_usages(self, session_id: str) -> list[dict]:
        """Load all usage records for a session."""
        if not TOKEN_LOG_FILE.exists():
            return []

        usages = []
        with open(TOKEN_LOG_FILE) as f:
            for line in f:
                try:
                    record = json.loads(line.strip())
                    if record.get("session_id") == session_id:
                        usages.append(record)
                except json.JSONDecodeError:
                    continue
        return usages

    def _load_user_usages(self, user_id: str, days: int) -> list[dict]:
        """Load usage records for a user within the last N days."""
        if not TOKEN_LOG_FILE.exists():
            return []

        cutoff = datetime.utcnow()
        usages = []

        with open(TOKEN_LOG_FILE) as f:
            for line in f:
                try:
                    record = json.loads(line.strip())
                    if record.get("user_id") == user_id:
                        ts = datetime.fromisoformat(record["timestamp"])
                        if (cutoff - ts).days <= days:
                            usages.append(record)
                except (json.JSONDecodeError, ValueError):
                    continue

        return usages


# Singleton instance
token_counter = TokenCounter(
    max_tokens_per_session=100_000,  # ~50-100 LLM calls depending on model
    max_cost_per_session=1.0,  # $1.00 per session max
)
