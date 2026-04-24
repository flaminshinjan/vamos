"""Trend scan — rank a portfolio's holdings by recent momentum.

For up to ``MAX_HOLDINGS`` of the top-weighted positions, pull a 1-month
google_finance graph, compute 5d / 20d returns, and split into top up- and
down-movers. Capped because each holding is one SerpApi call.
"""

from __future__ import annotations

import logging
import time
from typing import Iterator

from vamos_core.schemas.portfolio import Portfolio

from vamos_agents.providers import ProviderError, finance_query, graph_closes
from vamos_agents.workflows._deps import WorkflowDeps
from vamos_agents.workflows._events import card, error, tool_done, tool_start
from vamos_agents.workflows.schemas import TrendMover, TrendScan

logger = logging.getLogger(__name__)

MAX_HOLDINGS = 8


def scan_trends(portfolio: Portfolio, *, deps: WorkflowDeps) -> Iterator[dict]:
    if deps.serp is None:
        yield error("SERPAPI_KEY not set — trend scan unavailable", code=503)
        return

    holdings = sorted(
        portfolio.holdings.stocks, key=lambda h: h.weight_in_portfolio, reverse=True
    )[:MAX_HOLDINGS]
    symbols = [h.symbol for h in holdings]
    if not symbols:
        yield error("Portfolio has no stock holdings to scan", code=400)
        return

    ts = time.perf_counter()
    yield tool_start(
        "fetch_holding_graphs",
        "Pulling 1-month price graphs",
        f"{len(symbols)} top-weighted holdings",
    )
    movers: list[TrendMover] = []
    for sym in symbols:
        try:
            raw = deps.serp.google_finance(finance_query(sym), window="1M")
        except ProviderError as e:
            logger.warning("google_finance %s failed: %s", sym, e)
            continue
        m5, m20, last = _momentum(raw)
        movers.append(
            TrendMover(symbol=sym, change_pct_5d=m5, change_pct_20d=m20, last_close=last)
        )
    yield tool_done("fetch_holding_graphs", ts)

    ts = time.perf_counter()
    yield tool_start("rank_movers", "Ranking up/down movers", "5-day return")
    rated = [m for m in movers if m.change_pct_5d is not None]
    rated.sort(key=lambda m: m.change_pct_5d or 0)
    down = [m for m in rated if (m.change_pct_5d or 0) < 0][:5]
    up = list(reversed([m for m in rated if (m.change_pct_5d or 0) > 0]))[:5]
    out = TrendScan(up_movers=up, down_movers=down, summary=_summarize(up, down, len(symbols)))
    yield tool_done("rank_movers", ts)
    yield card("trend_scan", {"scan": out.model_dump()})


def _momentum(payload: dict) -> tuple[float | None, float | None, float | None]:
    closes = graph_closes(payload)
    if not closes:
        return None, None, None
    last = closes[-1]
    m5 = _pct(closes[-6], last) if len(closes) >= 6 else None
    m20 = _pct(closes[-21], last) if len(closes) >= 21 else None
    return m5, m20, last


def _pct(prev: float, last: float) -> float | None:
    if prev == 0:
        return None
    return (last - prev) / prev * 100.0


def _summarize(up: list[TrendMover], down: list[TrendMover], total: int) -> str:
    if not up and not down:
        return f"No clear trend in your top {total} holdings (5-day window)."
    parts: list[str] = []
    if up:
        parts.append(f"{up[0].symbol} +{up[0].change_pct_5d:.2f}% leads {len(up)} gainers")
    if down:
        parts.append(f"{down[0].symbol} {down[0].change_pct_5d:.2f}% leads {len(down)} losers")
    return "; ".join(parts) + "."
