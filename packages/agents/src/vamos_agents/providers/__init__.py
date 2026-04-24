"""External data providers used by chat-agent workflows.

Today: SerpApi only (google_news + google_finance). The Twelve Data
integration is documented as future work in ``docs/twelve-data.md``.

``get_serpapi`` returns ``None`` when ``SERPAPI_KEY`` isn't set so the chat
agent can hide tools that depend on it.
"""

from __future__ import annotations

from vamos_agents.providers.base import ProviderError, TTLCache
from vamos_agents.providers.serpapi import (
    SerpApiClient,
    finance_query,
    graph_closes,
)
from vamos_agents.settings import Settings


def get_serpapi(settings: Settings) -> SerpApiClient | None:
    if not settings.serpapi_key:
        return None
    return SerpApiClient(settings.serpapi_key, cache_ttl_s=settings.provider_cache_ttl_s)


__all__ = [
    "ProviderError",
    "SerpApiClient",
    "TTLCache",
    "finance_query",
    "get_serpapi",
    "graph_closes",
]
