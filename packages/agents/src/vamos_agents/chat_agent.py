"""Conversational chat agent — the one Claude drives end-to-end.

Unlike `advisor.brief_stream` (which is a single forced tool-use call for
structured briefings), this agent handles ALL user input: small talk,
data questions, and full briefings. Claude decides:

- Pure text reply → greetings, help, ad-hoc Q&A
- Call `show_market_snapshot` → render market card + short comment
- Call `show_classified_news` → render news card + comment
- Call `show_concentration_risk` → render risk card + comment
- Call `produce_briefing` → trigger the full causal reasoning pipeline

The client sees a single SSE stream: text deltas interleaved with card
events. No hardcoded branching by regex in the frontend.
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any, Iterator

from anthropic import Anthropic

from vamos_core import DataLoader
from vamos_core.analytics import (
    compute_market_trend,
    compute_portfolio_analytics,
    rank_news_for_portfolio,
)

from vamos_agents.advisor import AdvisorAgent
from vamos_agents.settings import Settings, get_settings

logger = logging.getLogger(__name__)


# ── Tool schemas Claude sees ─────────────────────────────────────────

CHAT_TOOLS = [
    {
        "name": "show_market_snapshot",
        "description": (
            "Display a market snapshot card — indices, top gaining/losing "
            "sectors, overall sentiment. Use when the user asks about the "
            "market, indices, or today's moves broadly."
        ),
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "show_classified_news",
        "description": (
            "Display the ranked news card — today's headlines ordered by "
            "relevance to the user's portfolio, each tagged with sentiment, "
            "scope, and impact score. Use when the user asks about news, "
            "headlines, or drivers."
        ),
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "show_concentration_risk",
        "description": (
            "Display the concentration-risk card — per-sector allocation "
            "and any alerts above the 40% / 20% thresholds. Use when the "
            "user asks about risk, concentration, or exposure."
        ),
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "produce_briefing",
        "description": (
            "Run the full causal briefing pipeline — maps news to sectors "
            "to held stocks to portfolio impact, with conflict flags, "
            "confidence score, and self-evaluation. Use when the user asks "
            "'why did my portfolio move', 'trace the causal chain', or "
            "requests a full briefing. This is expensive (~5-10s) so only "
            "use it for analytical questions that actually need it."
        ),
        "input_schema": {"type": "object", "properties": {}},
    },
]


def _build_system(portfolio, trend, analytics, news_count: int) -> str:
    """System prompt with live portfolio context baked in."""
    alerts = ""
    if analytics.concentration_risk and analytics.alerts:
        alerts = " · ALERT: " + "; ".join(
            f"{a.name} {a.weight_percent:.0f}%" for a in analytics.alerts
        )
    return f"""You are Aarthik — an autonomous financial advisor for Indian markets.

You're speaking with {portfolio.user_name} (portfolio: {portfolio.portfolio_type.value.lower().replace("_", " ")}, risk: {portfolio.risk_profile.value.lower()}).

Today (2026-04-21 · NSE close):
- Market sentiment: {trend.overall_sentiment.value} ({trend.avg_broad_change:+.2f}% broad avg across NIFTY50/SENSEX)
- Advancing sectors: {trend.advancing_sectors} / Declining: {trend.declining_sectors}
- Portfolio day P&L: {analytics.day_summary.day_change_percent:+.2f}% ({analytics.day_summary.day_change_absolute:+,.0f} INR){alerts}
- Relevant news: {news_count} articles ranked by portfolio exposure

You have these tools to display data cards:
- show_market_snapshot — today's market overview
- show_classified_news — ranked news for this book
- show_concentration_risk — allocation + concentration alerts
- produce_briefing — full causal chain analysis with self-evaluation

## Guidelines

- Greetings / small talk: respond warmly in 1–2 sentences. NO tools. Then suggest what they could ask.
- Specific data questions (market, news, risk): call the matching show_* tool AND add one short sentence of framing.
- "Why did my portfolio move", "trace the causal chain", "brief me": call produce_briefing. Don't try to narrate the answer yourself — the briefing IS the answer.
- Don't invent prices, holdings, or news that isn't in the context above. If you don't have data, say so plainly.
- Never wrap a tool call in excessive commentary. Tool call + one framing sentence is the ideal shape.
- Use first name ({portfolio.user_name.split()[0]}) sparingly, not every message.

Keep replies tight. A sophisticated investor should feel your time is worth their time.
"""


# ── Event kinds ───────────────────────────────────────────────────────
TEXT_DELTA = "text_delta"
TOOL_CALL = "tool_call"
CARD = "card"
BRIEFING_STARTED = "briefing_started"
DONE = "done"
ERROR = "error"


def chat_stream(
    *,
    loader: DataLoader,
    portfolio_id: str,
    user_message: str,
    history: list[dict[str, str]] | None = None,
    settings: Settings | None = None,
    advisor: AdvisorAgent | None = None,
) -> Iterator[dict[str, Any]]:
    """Run one chat turn. Yields SSE-friendly events.

    Events:
        {"event": "text_delta", "data": {"text": "..."}}
        {"event": "tool_call",  "data": {"id": "...", "name": "...", "status": "active|done"}}
        {"event": "card",       "data": {"kind": "market|news|risk", ...}}
        {"event": "briefing_started", "data": {}}
          (then the full brief_stream event sequence follows — tool_call,
           start, delta, briefing, evaluation, done)
        {"event": "done", "data": {"usage": {...}, "latency_ms": N}}
        {"event": "error", "data": {"error": "..."}}
    """
    settings = settings or get_settings()
    history = history or []
    t0 = time.perf_counter()

    if not settings.anthropic_api_key:
        yield {
            "event": ERROR,
            "data": {"error": "ANTHROPIC_API_KEY not set", "code": 502},
        }
        return

    try:
        portfolio = loader.get_portfolio(portfolio_id)
    except KeyError as e:
        yield {"event": ERROR, "data": {"error": str(e), "code": 404}}
        return

    snapshot = loader.market_snapshot
    trend = compute_market_trend(snapshot)
    analytics = compute_portfolio_analytics(portfolio)
    ranked_news = rank_news_for_portfolio(loader.news, portfolio, top_k=8)

    system = _build_system(portfolio, trend, analytics, len(ranked_news))

    messages: list[dict[str, Any]] = [*history, {"role": "user", "content": user_message}]

    client = Anthropic(
        api_key=settings.anthropic_api_key,
        timeout=settings.request_timeout_s,
    )

    tool_calls_made: list[str] = []
    usage: dict[str, int] = {}

    try:
        with client.messages.stream(
            model=settings.reasoning_model,
            max_tokens=768,  # short replies keep latency low
            system=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
            tools=CHAT_TOOLS,
            messages=messages,
        ) as stream:
            for event in stream:
                etype = getattr(event, "type", None)
                if etype == "content_block_start":
                    block = getattr(event, "content_block", None)
                    if block is not None and getattr(block, "type", None) == "tool_use":
                        tool_calls_made.append(block.name)
                        yield {
                            "event": TOOL_CALL,
                            "data": {
                                "id": block.id,
                                "name": block.name,
                                "status": "active",
                            },
                        }
                elif etype == "content_block_delta":
                    delta = getattr(event, "delta", None)
                    if delta is None:
                        continue
                    dtype = getattr(delta, "type", None)
                    if dtype == "text_delta":
                        text = getattr(delta, "text", "") or ""
                        if text:
                            yield {"event": TEXT_DELTA, "data": {"text": text}}
                    # tool-use input deltas are ignored — our tools take no args
            final = stream.get_final_message()
    except Exception as e:
        logger.exception("Chat stream failed")
        yield {"event": ERROR, "data": {"error": f"LLM call failed: {e}", "code": 502}}
        return

    try:
        usage = {
            "input_tokens": getattr(final.usage, "input_tokens", 0),
            "output_tokens": getattr(final.usage, "output_tokens", 0),
            "cache_read_input_tokens": getattr(final.usage, "cache_read_input_tokens", 0) or 0,
            "cache_creation_input_tokens": getattr(
                final.usage, "cache_creation_input_tokens", 0
            )
            or 0,
        }
    except Exception:
        usage = {}

    # Emit tool_call done + card events in the order Claude called them
    for name in tool_calls_made:
        yield {"event": TOOL_CALL, "data": {"name": name, "status": "done"}}
        if name == "show_market_snapshot":
            yield {
                "event": CARD,
                "data": {
                    "kind": "market",
                    "trend": trend.model_dump(),
                },
            }
        elif name == "show_classified_news":
            yield {
                "event": CARD,
                "data": {
                    "kind": "news",
                    "news": [
                        {
                            "relevance_score": r.relevance_score,
                            "matched_sectors": r.matched_sectors,
                            "matched_stocks": r.matched_stocks,
                            "portfolio_exposure_pct": r.portfolio_exposure_pct,
                            "why_relevant": r.reason,
                            "article": r.article.model_dump(),
                        }
                        for r in ranked_news
                    ],
                },
            }
        elif name == "show_concentration_risk":
            yield {
                "event": CARD,
                "data": {
                    "kind": "risk",
                    "analytics": analytics.model_dump(),
                },
            }
        elif name == "produce_briefing":
            # Hand off to the full briefing pipeline — it emits its own
            # tool_call, delta, briefing, evaluation, done events which the
            # frontend already knows how to render.
            yield {"event": BRIEFING_STARTED, "data": {"portfolio_id": portfolio_id}}
            if advisor is not None:
                for evt in advisor.brief_stream(portfolio_id, top_news=8):
                    yield evt

    yield {
        "event": DONE,
        "data": {
            "usage": usage,
            "latency_ms": int((time.perf_counter() - t0) * 1000),
            "tool_calls": tool_calls_made,
        },
    }
