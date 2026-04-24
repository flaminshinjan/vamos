"""Sector performance workflow — SerpApi only.

Pulls the sector index quote (google_finance) plus sector-level headlines
(google_news). Per-constituent quotes are intentionally skipped to keep
this to two SerpApi calls per turn — users can drill in via lookup_stock.
"""

from __future__ import annotations

import logging
import time
from typing import Iterator

from vamos_agents.providers import ProviderError
from vamos_agents.workflows._deps import WorkflowDeps
from vamos_agents.workflows._events import card, error, tool_done, tool_start
from vamos_agents.workflows.schemas import NewsRef, SectorPerformanceCard, StockQuote

logger = logging.getLogger(__name__)


# Maps the sector names in our domain → Google Finance index identifiers.
_SECTOR_INDEX: dict[str, str] = {
    "BANKING": "NIFTY_BANK:INDEXNSE",
    "IT": "NIFTY_IT:INDEXNSE",
    "AUTO": "NIFTY_AUTO:INDEXNSE",
    "PHARMA": "NIFTY_PHARMA:INDEXNSE",
    "FMCG": "NIFTY_FMCG:INDEXNSE",
    "ENERGY": "NIFTY_ENERGY:INDEXNSE",
    "METALS": "NIFTY_METAL:INDEXNSE",
}


def lookup_sector(sector: str, *, deps: WorkflowDeps) -> Iterator[dict]:
    sec = sector.upper().strip()
    index_query = _SECTOR_INDEX.get(sec)
    if index_query is None:
        yield error(
            f"Sector '{sector}' not supported. Try one of: {', '.join(_SECTOR_INDEX)}",
            code=400,
        )
        return
    if deps.serp is None:
        yield error("SERPAPI_KEY not set — sector lookup unavailable", code=503)
        return

    # 1. sector index quote
    ts = time.perf_counter()
    yield tool_start("fetch_sector_index", "Fetching sector index", index_query)
    index_quote: StockQuote | None = None
    try:
        raw = deps.serp.google_finance(index_query)
        index_quote = StockQuote.from_serpapi_finance(sec, raw)
    except ProviderError as e:
        logger.warning("google_finance %s failed: %s", index_query, e)
    yield tool_done("fetch_sector_index", ts)

    # 2. sector news
    ts = time.perf_counter()
    yield tool_start("fetch_sector_news", "Fetching sector news", f"{sec} headlines")
    headlines: list[NewsRef] = []
    try:
        news_raw = deps.serp.search_news(f"{sec} sector India NSE", num=8)
        headlines = [NewsRef(**n) for n in news_raw]
    except ProviderError as e:
        logger.warning("serpapi sector news failed for %s: %s", sec, e)
    yield tool_done("fetch_sector_news", ts)

    out = SectorPerformanceCard(
        sector=sec,
        index_quote=index_quote,
        headlines=headlines,
        summary=_summarize(sec, index_quote, headlines),
    )
    yield card("sector_performance", {"sector": out.model_dump()})


def _summarize(sector: str, quote: StockQuote | None, headlines: list[NewsRef]) -> str:
    if quote is None or quote.change_pct is None:
        if headlines:
            return f"{sector}: live index unavailable. Top headline: \"{headlines[0].title}\"."
        return f"{sector}: live data unavailable."
    direction = "up" if quote.change_pct >= 0 else "down"
    base = f"{sector} index {quote.change_pct:+.2f}% — {direction} on the day."
    if headlines:
        return f"{base} Top headline: \"{headlines[0].title}\"."
    return base
