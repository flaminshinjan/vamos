"""Market-wide future prediction workflow (image #2) — SerpApi only.

Three steps:
    1. check_current_market_trends   — google_news top 15 → Haiku ranked summary
    2. check_previous_trends         — google_finance NIFTY 50 historical graph
    3. compute_performance_trend     — momentum math → directional outlook
"""

from __future__ import annotations

import logging
import time
from typing import Iterator

from vamos_agents.providers import ProviderError, graph_closes
from vamos_agents.workflows._deps import WorkflowDeps
from vamos_agents.workflows._events import card, error, tool_done, tool_start
from vamos_agents.workflows.schemas import HistoricalPoint, MarketForecast, NewsRef

logger = logging.getLogger(__name__)

# Google Finance index identifier for NIFTY 50.
_NIFTY_QUERY = "NIFTY_50:INDEXNSE"


def forecast_market(*, deps: WorkflowDeps) -> Iterator[dict]:
    if deps.serp is None:
        yield error("SERPAPI_KEY not set — forecast unavailable", code=503)
        return

    # 1. current trends
    ts = time.perf_counter()
    yield tool_start(
        "check_current_market_trends",
        "Scanning current market trends",
        "Top 15 news → ranked summary",
    )
    try:
        news_raw = deps.serp.search_news("Indian stock market NIFTY today", num=15)
    except ProviderError as e:
        yield tool_done("check_current_market_trends", ts)
        yield error(str(e))
        return
    headlines = [NewsRef(**n) for n in news_raw]
    current_summary = _haiku_rank(deps, headlines)
    yield tool_done("check_current_market_trends", ts)

    # 2. previous trends (historical via Google Finance graph)
    ts = time.perf_counter()
    yield tool_start("check_previous_trends", "Pulling previous trends", "NIFTY 50 · 1-month graph")
    try:
        finance_payload = deps.serp.google_finance(_NIFTY_QUERY, window="1M")
    except ProviderError as e:
        yield tool_done("check_previous_trends", ts)
        yield error(str(e))
        return
    historical = _to_history(finance_payload)
    yield tool_done("check_previous_trends", ts)

    # 3. momentum + outlook
    ts = time.perf_counter()
    yield tool_start("compute_performance_trend", "Computing performance trend", "5-day & 20-day momentum")
    closes = [p.close for p in historical]
    m5 = _momentum_pct(closes, lookback=5)
    m20 = _momentum_pct(closes, lookback=20)
    headline = (
        f"NIFTY 50: 5d {m5:+.2f}% / 20d {m20:+.2f}%"
        if m5 is not None and m20 is not None
        else "NIFTY 50 outlook"
    )
    forecast = MarketForecast(
        headline=headline,
        current_summary=current_summary,
        historical=historical,
        momentum_pct_5d=m5,
        momentum_pct_20d=m20,
        outlook=_outlook(m5, m20),
        headlines=headlines[:8],
    )
    yield tool_done("compute_performance_trend", ts)
    yield card("forecast", {"forecast": forecast.model_dump()})


def _haiku_rank(deps: WorkflowDeps, headlines: list[NewsRef]) -> str:
    if not headlines:
        return "No fresh market headlines available."
    if not deps.settings.anthropic_api_key:
        return f"{len(headlines)} headlines scraped; live ranking unavailable."
    bullets = "\n".join(f"- {h.title} ({h.source}, {h.date})" for h in headlines)
    user = (
        f"Headlines about today's Indian market:\n{bullets}\n\n"
        "Rank these by market-moving importance and produce a 4–6 sentence summary "
        "of what is driving the market today. Be concrete. No fluff."
    )
    try:
        resp = deps.anthropic.messages.create(
            model=deps.settings.eval_model,
            max_tokens=400,
            system="You are a market microstructure analyst.",
            messages=[{"role": "user", "content": user}],
        )
        text = "".join(b.text for b in resp.content if getattr(b, "type", None) == "text").strip()
        return text or f"{len(headlines)} headlines scraped; ranking returned empty."
    except Exception as e:
        logger.warning("Haiku market ranking failed: %s", e)
        return f"{len(headlines)} headlines scraped; live ranking failed."


def _to_history(payload: dict) -> list[HistoricalPoint]:
    out: list[HistoricalPoint] = []
    for p in payload.get("graph") or []:
        try:
            out.append(HistoricalPoint(date=str(p.get("date", "")), close=float(p["price"])))
        except (KeyError, ValueError, TypeError):
            continue
    return out


def _momentum_pct(closes: list[float], *, lookback: int) -> float | None:
    if len(closes) < lookback + 1:
        return None
    last = closes[-1]
    prev = closes[-lookback - 1]
    if prev == 0:
        return None
    return (last - prev) / prev * 100.0


def _outlook(m5: float | None, m20: float | None) -> str:
    if m5 is None or m20 is None:
        return "Insufficient history for a directional read."
    if m5 > 1 and m20 > 0:
        return "Short-term momentum positive, broader trend supportive — bias up."
    if m5 < -1 and m20 < 0:
        return "Both short and intermediate momentum negative — bias down."
    if m5 > 0 and m20 < 0:
        return "Short-term bounce against a broader downtrend — likely counter-trend."
    if m5 < 0 and m20 > 0:
        return "Pullback inside an intact uptrend."
    return "Mixed signals — sideways to range-bound."
