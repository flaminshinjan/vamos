"""SerpApi client — Google News + Google Finance for our finance queries.

This is the only external data provider the chat agent uses today. The
``twelve_data`` integration referenced in ``docs/twelve-data.md`` will slot
in here later if/when we want richer OHLC + dedicated time series.
"""

from __future__ import annotations

import logging
from typing import Any

from vamos_agents.providers.base import ProviderError, TTLCache, http_get_json

logger = logging.getLogger(__name__)

_BASE_URL = "https://serpapi.com/search.json"


def finance_query(symbol_or_index: str, *, default_exchange: str = "NSE") -> str:
    """Format a Google Finance query.

    >>> finance_query("INFY")
    'INFY:NSE'
    >>> finance_query("NIFTY_50:INDEXNSE")
    'NIFTY_50:INDEXNSE'
    """
    s = symbol_or_index.upper().strip()
    if ":" in s:
        return s
    return f"{s}:{default_exchange}"


class SerpApiClient:
    def __init__(
        self,
        api_key: str,
        *,
        cache_ttl_s: int = 300,
        timeout_s: float = 15.0,
    ) -> None:
        self.api_key = api_key
        self.timeout_s = timeout_s
        self._cache = TTLCache(cache_ttl_s)

    # ── News ────────────────────────────────────────────────────────

    def search_news(self, query: str, num: int = 15) -> list[dict[str, Any]]:
        """Run a Google News search. Returns up to ``num`` normalized items:
        ``{"title", "snippet", "url", "source", "date"}``."""
        cache_key = f"news:{query}:{num}"
        cached = self._cache.get(cache_key)
        if cached is not None:
            return cached
        payload = self._raw(
            {"engine": "google_news", "q": query, "api_key": self.api_key}
        )
        results = _normalize_news(payload, num)
        self._cache.set(cache_key, results)
        return results

    # ── Finance (price + history) ───────────────────────────────────

    def google_finance(self, query: str, *, window: str | None = None) -> dict[str, Any]:
        """Fetch a Google Finance card.

        ``window`` accepts the same labels as the Google Finance UI:
        ``"1D"``, ``"5D"``, ``"1M"``, ``"6M"``, ``"YTD"``, ``"1Y"``,
        ``"5Y"``, ``"MAX"``. Defaults to ``"1D"`` (intraday).
        """
        cache_key = f"finance:{query}:{window or '1D'}"
        cached = self._cache.get(cache_key)
        if cached is not None:
            return cached
        params: dict[str, Any] = {
            "engine": "google_finance",
            "q": query,
            "api_key": self.api_key,
        }
        if window:
            params["window"] = window
        payload = self._raw(params)
        self._cache.set(cache_key, payload)
        return payload

    # ── Internals ───────────────────────────────────────────────────

    def _raw(self, params: dict[str, Any]) -> dict[str, Any]:
        payload = http_get_json(_BASE_URL, params, self.timeout_s)
        if "error" in payload:
            raise ProviderError(f"serpapi {params.get('engine','?')}: {payload['error']}")
        return payload


# ── Normalization helpers ────────────────────────────────────────────


def _normalize_news(payload: dict[str, Any], limit: int) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for item in payload.get("news_results") or []:
        # google_news sometimes nests follow-up coverage under "stories".
        stories = item.get("stories")
        if stories:
            for s in stories:
                out.append(_normalize_one(s))
                if len(out) >= limit:
                    return out
        else:
            out.append(_normalize_one(item))
        if len(out) >= limit:
            return out
    return out


def _normalize_one(s: dict[str, Any]) -> dict[str, Any]:
    src = s.get("source")
    source = src.get("name") if isinstance(src, dict) else (src or "")
    return {
        "title": s.get("title", ""),
        "snippet": s.get("snippet", "") or "",
        "url": s.get("link", "") or "",
        "source": source,
        "date": s.get("date", "") or "",
    }


def graph_closes(payload: dict[str, Any]) -> list[float]:
    """Pull the price series out of a google_finance payload, oldest-first."""
    out: list[float] = []
    for p in payload.get("graph") or []:
        try:
            out.append(float(p["price"]))
        except (KeyError, ValueError, TypeError):
            continue
    return out
