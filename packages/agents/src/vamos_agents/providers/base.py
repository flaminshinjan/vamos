"""Shared HTTP + cache primitives for external data providers."""

from __future__ import annotations

import logging
import threading
import time
from typing import Any

import httpx

logger = logging.getLogger(__name__)


class ProviderError(RuntimeError):
    """Raised when a provider call fails or returns an error payload."""


class TTLCache:
    """Thread-safe in-memory TTL cache.

    External quotes/news change slowly relative to a chat turn; cache 5 min
    by default so a flurry of follow-up questions doesn't burn the budget.
    """

    def __init__(self, ttl_s: int) -> None:
        self.ttl_s = ttl_s
        self._store: dict[str, tuple[float, Any]] = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> Any | None:
        with self._lock:
            entry = self._store.get(key)
        if entry is None:
            return None
        expires_at, value = entry
        if time.monotonic() > expires_at:
            with self._lock:
                self._store.pop(key, None)
            return None
        return value

    def set(self, key: str, value: Any) -> None:
        with self._lock:
            self._store[key] = (time.monotonic() + self.ttl_s, value)


def http_get_json(url: str, params: dict[str, Any], timeout_s: float) -> dict[str, Any]:
    try:
        r = httpx.get(url, params=params, timeout=timeout_s)
        r.raise_for_status()
        return r.json()
    except httpx.HTTPError as e:
        raise ProviderError(f"HTTP error for {url}: {e}") from e
