"""Live market snapshot — SerpApi-backed NIFTY 50 + SENSEX quotes.

Replaces the mock ``show_market_snapshot`` for "how's the market today"
when SerpApi is configured. Two parallel-style google_finance calls →
quote pair + Haiku one-line read.
"""

from __future__ import annotations

import logging
import time
from typing import Iterator

from vamos_agents.providers import ProviderError
from vamos_agents.workflows._deps import WorkflowDeps
from vamos_agents.workflows._events import card, note, tool_done, tool_start
from vamos_agents.workflows.schemas import StockQuote

logger = logging.getLogger(__name__)

_NIFTY = "NIFTY_50:INDEXNSE"
_SENSEX = "SENSEX:INDEXBOM"


def lookup_market(*, deps: WorkflowDeps) -> Iterator[dict]:
    if deps.serp is None:
        yield note(
            "Live market data isn't connected, so I can't pull a fresh "
            "NIFTY/SENSEX read right now.",
            tone="neutral",
        )
        return

    ts = time.perf_counter()
    yield tool_start("fetch_indices", "Fetching live indices", "NIFTY 50 + SENSEX")

    quotes: list[StockQuote] = []
    for sym, query in [("NIFTY 50", _NIFTY), ("SENSEX", _SENSEX)]:
        try:
            raw = deps.serp.google_finance(query)
            quotes.append(StockQuote.from_serpapi_finance(sym, raw))
        except ProviderError as e:
            logger.warning("lookup_market %s failed: %s", query, e)
    yield tool_done("fetch_indices", ts)

    valid = [q for q in quotes if q.price is not None and q.change_pct is not None]
    if not valid:
        yield note(
            "I couldn't pull live NIFTY or SENSEX quotes just now — the data "
            "provider isn't responding. Try again in a moment.",
            tone="negative",
        )
        return

    avg_pct = sum(q.change_pct or 0 for q in valid) / len(valid)
    sentiment = "BULLISH" if avg_pct >= 0.5 else "BEARISH" if avg_pct <= -0.5 else "NEUTRAL"

    ts = time.perf_counter()
    yield tool_start("summarize_market", "Writing the read", f"avg {avg_pct:+.2f}%")
    summary = _haiku_summary(deps, valid, avg_pct, sentiment)
    yield tool_done("summarize_market", ts)

    yield card(
        "live_market",
        {
            "indices": [
                {
                    "symbol": q.symbol,
                    "price": q.price,
                    "change_pct": q.change_pct,
                    "currency": q.currency,
                }
                for q in quotes
            ],
            "avg_change_pct": round(avg_pct, 2),
            "sentiment": sentiment,
            "summary": summary,
        },
    )


def _haiku_summary(
    deps: WorkflowDeps, quotes: list[StockQuote], avg_pct: float, sentiment: str
) -> str:
    if not deps.settings.anthropic_api_key:
        return _fallback(quotes, avg_pct, sentiment)
    bullets = "\n".join(
        f"- {q.symbol}: {q.price:.2f} ({q.change_pct:+.2f}%)" for q in quotes
    )
    user = (
        f"Live Indian market indices right now:\n{bullets}\n\n"
        f"Average move: {avg_pct:+.2f}% ({sentiment}).\n\n"
        "Write 1–2 sentences answering 'how's the market doing today'. State "
        "direction, magnitude, and the implied tone. Plain text — no markdown, "
        "no bullets, no disclaimers."
    )
    try:
        resp = deps.anthropic.messages.create(
            model=deps.settings.eval_model,
            max_tokens=160,
            system="You are a sober equity analyst.",
            messages=[{"role": "user", "content": user}],
        )
        text = "".join(b.text for b in resp.content if getattr(b, "type", None) == "text").strip()
        return text or _fallback(quotes, avg_pct, sentiment)
    except Exception as e:
        logger.warning("lookup_market haiku failed: %s", e)
        return _fallback(quotes, avg_pct, sentiment)


def _fallback(quotes: list[StockQuote], avg_pct: float, sentiment: str) -> str:
    parts = ", ".join(f"{q.symbol} {q.change_pct:+.2f}%" for q in quotes)
    return f"Indian market is {sentiment.lower()} today — {parts} (avg {avg_pct:+.2f}%)."
