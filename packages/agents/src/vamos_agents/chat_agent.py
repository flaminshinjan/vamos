"""Conversational chat agent — Claude routes every user message.

One Claude streaming call per turn. The model picks zero, one, or several
tools from the catalog below; we stream Claude's text deltas, then dispatch
each tool call (in the order Claude made them) to its handler. Handlers
either emit a single ``card`` event from local data, or hand off to a
workflow generator that emits its own granular ``tool_call`` + ``card``
events.

Tools that depend on external providers are *omitted from the catalog*
when the corresponding API key isn't set, so Claude never picks something
we can't serve.
"""

from __future__ import annotations

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
from vamos_agents.providers import get_serpapi
from vamos_agents.settings import Settings, get_settings
from vamos_agents.workflows import (
    WorkflowDeps,
    diagnose_stock,
    forecast_market,
    lookup_sector,
    lookup_stock,
    scan_trends,
)
from vamos_agents.workflows.schemas import HoldingPerformance, HoldingsPerformanceCard

logger = logging.getLogger(__name__)


# ── Tool catalog ─────────────────────────────────────────────────────
#
# Each tool's description tells Claude *when not* to use it, which is what
# replaces frontend regex-routing.

_TOOL_SHOW_MARKET = {
    "name": "show_market_snapshot",
    "description": (
        "Display the local market snapshot card — NIFTY/SENSEX, top gaining "
        "and losing sectors, overall sentiment. Use for broad market questions "
        "like 'how is the market doing'. This uses today's loaded snapshot, "
        "not live web data — for live or forward-looking takes use "
        "forecast_market instead."
    ),
    "input_schema": {"type": "object", "properties": {}},
}

_TOOL_SHOW_NEWS = {
    "name": "show_classified_news",
    "description": (
        "Display the ranked news card — today's headlines ordered by relevance "
        "to this portfolio, each tagged with sentiment, scope, and impact. Use "
        "when the user asks about news, headlines, or what's driving the day."
    ),
    "input_schema": {"type": "object", "properties": {}},
}

_TOOL_SHOW_RISK = {
    "name": "show_concentration_risk",
    "description": (
        "Display the concentration-risk card — per-sector allocation and any "
        "alerts above the 40% / 20% thresholds. Use when the user asks about "
        "risk, concentration, or exposure."
    ),
    "input_schema": {"type": "object", "properties": {}},
}

_TOOL_SHOW_HOLDINGS = {
    "name": "show_my_holdings_performance",
    "description": (
        "Display per-holding day P&L and overall gain — the user's stocks "
        "ranked by today's move. Use when the user asks 'how are my stocks "
        "doing' or 'which of my positions moved'. Uses local portfolio data, "
        "no external calls."
    ),
    "input_schema": {"type": "object", "properties": {}},
}

_TOOL_LOOKUP_STOCK = {
    "name": "lookup_stock",
    "description": (
        "Fetch a live quote for a single named stock from Google Finance. "
        "Use when the user asks 'how is INFY performing' or 'what's the price "
        "of TCS'. Do NOT use this to explain *why* a stock moved — call "
        "diagnose_stock for that. Symbol should be the bare NSE ticker "
        "(e.g. INFY, HDFCBANK)."
    ),
    "input_schema": {
        "type": "object",
        "required": ["symbol"],
        "properties": {
            "symbol": {
                "type": "string",
                "description": "NSE ticker symbol, e.g. INFY, HDFCBANK, RELIANCE.",
            }
        },
    },
}

_TOOL_LOOKUP_SECTOR = {
    "name": "lookup_sector",
    "description": (
        "Pull live performance for a named sector — sector index quote "
        "(Google Finance) plus headlines (Google News). Use when the user "
        "asks 'how is the IT sector doing' or 'what's banking up to today'. "
        "Supported sectors: BANKING, IT, AUTO, PHARMA, FMCG, ENERGY, METALS."
    ),
    "input_schema": {
        "type": "object",
        "required": ["sector"],
        "properties": {
            "sector": {
                "type": "string",
                "description": "Sector name. One of BANKING, IT, AUTO, PHARMA, FMCG, ENERGY, METALS.",
            }
        },
    },
}

_TOOL_SCAN_TRENDS = {
    "name": "scan_trends",
    "description": (
        "Scan all of the user's stock holdings for 5-day and 20-day momentum, "
        "splitting into top up- and down-movers. Use when the user asks about "
        "trends, momentum, 'what's going up/down in my book', or recent winners "
        "and losers."
    ),
    "input_schema": {"type": "object", "properties": {}},
}

_TOOL_FORECAST = {
    "name": "forecast_market",
    "description": (
        "Run the market-wide forecast pipeline — Google News ranking + NIFTY "
        "50 historical graph from Google Finance → directional outlook. Use "
        "when the user asks 'where is the market headed', 'future', 'predict', "
        "or 'outlook'. Multi-step (~5-8s); only use it when a forward-looking "
        "view is actually being asked for, not for a simple 'how is the market'."
    ),
    "input_schema": {"type": "object", "properties": {}},
}

_TOOL_DIAGNOSE_STOCK = {
    "name": "diagnose_stock",
    "description": (
        "Run the stock-diagnosis pipeline for one named stock — live quote + "
        "news + LLM reasoning over the headlines. Use when the user asks "
        "'why is INFY down', 'what happened to TCS', or otherwise wants the "
        "*explanation* for a specific stock's move. Do NOT use for portfolio-"
        "wide 'why did my portfolio move' questions — call produce_briefing "
        "for that."
    ),
    "input_schema": {
        "type": "object",
        "required": ["symbol"],
        "properties": {
            "symbol": {
                "type": "string",
                "description": "NSE ticker symbol, e.g. INFY, HDFCBANK.",
            }
        },
    },
}

_TOOL_PRODUCE_BRIEFING = {
    "name": "produce_briefing",
    "description": (
        "Run the full causal briefing pipeline — maps news to sectors to held "
        "stocks to portfolio impact, with conflict flags, confidence score, "
        "and self-evaluation. Use when the user asks 'why did MY portfolio "
        "move', 'trace the causal chain', or requests a full briefing. This "
        "is expensive (~5-10s) — only use it for portfolio-wide causal "
        "questions, not single-stock or generic market ones."
    ),
    "input_schema": {"type": "object", "properties": {}},
}


def _build_tool_catalog(*, has_serp: bool) -> list[dict]:
    """Return the tool list Claude sees, hiding tools that need missing keys."""
    tools: list[dict] = [
        _TOOL_SHOW_MARKET,
        _TOOL_SHOW_NEWS,
        _TOOL_SHOW_RISK,
        _TOOL_SHOW_HOLDINGS,
        _TOOL_PRODUCE_BRIEFING,
    ]
    if has_serp:
        tools.extend(
            [
                _TOOL_LOOKUP_STOCK,
                _TOOL_LOOKUP_SECTOR,
                _TOOL_SCAN_TRENDS,
                _TOOL_FORECAST,
                _TOOL_DIAGNOSE_STOCK,
            ]
        )
    return tools


def _build_system(portfolio, trend, analytics, news_count: int, available: list[str]) -> str:
    alerts = ""
    if analytics.concentration_risk and analytics.alerts:
        alerts = " · ALERT: " + "; ".join(
            f"{a.name} {a.weight_percent:.0f}%" for a in analytics.alerts
        )
    tool_lines = "\n".join(f"- {name}" for name in available)
    return f"""You are Aarthik — an autonomous financial advisor for Indian markets.

You're speaking with {portfolio.user_name} (portfolio: {portfolio.portfolio_type.value.lower().replace("_", " ")}, risk: {portfolio.risk_profile.value.lower()}).

Today (NSE close):
- Market sentiment: {trend.overall_sentiment.value} ({trend.avg_broad_change:+.2f}% broad avg across NIFTY50/SENSEX)
- Advancing sectors: {trend.advancing_sectors} / Declining: {trend.declining_sectors}
- Portfolio day P&L: {analytics.day_summary.day_change_percent:+.2f}% ({analytics.day_summary.day_change_absolute:+,.0f} INR){alerts}
- Relevant news: {news_count} articles ranked by portfolio exposure

Tools available this turn:
{tool_lines}

## Routing rules

- Greetings / small talk → reply warmly in 1–2 sentences. NO tools. Suggest what they could ask next.
- "How is the market" → show_market_snapshot (local, instant).
- "What's the news" → show_classified_news.
- "How concentrated am I" / "What's my risk" → show_concentration_risk.
- "How are my stocks doing" → show_my_holdings_performance.
- "How is <SYMBOL> doing" / "Price of X" → lookup_stock(symbol=...).
- "How is <SECTOR> doing" → lookup_sector(sector=...).
- "What's trending up/down in my book" → scan_trends.
- "Where is the market headed" / "predict" / "future" → forecast_market.
- "Why is <SYMBOL> down/up" → diagnose_stock(symbol=...).
- "Why did MY portfolio move" / "brief me" → produce_briefing.

## Style

- Tool call + ONE short framing sentence is the ideal shape. Don't narrate the data — the card does.
- For forecast_market, diagnose_stock, produce_briefing: don't try to pre-empt the answer; the workflow IS the answer.
- Don't invent data. If you don't have a tool for something, say so.
- Use first name ({portfolio.user_name.split()[0]}) sparingly.

Keep replies tight. A sophisticated investor should feel their time is respected.
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
        {"event": "tool_call",  "data": {"id", "name", "status": "active|done", ...}}
        {"event": "card",       "data": {"kind": "...", ...}}
        {"event": "briefing_started", "data": {"portfolio_id": "..."}}
          (then the full brief_stream event sequence follows)
        {"event": "done", "data": {"usage", "latency_ms", "tool_calls"}}
        {"event": "error", "data": {"error", "code"}}
    """
    settings = settings or get_settings()
    history = history or []
    t0 = time.perf_counter()

    if not settings.anthropic_api_key:
        yield {"event": ERROR, "data": {"error": "ANTHROPIC_API_KEY not set", "code": 502}}
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

    client = Anthropic(api_key=settings.anthropic_api_key, timeout=settings.request_timeout_s)
    serp = get_serpapi(settings)
    deps = WorkflowDeps(anthropic=client, settings=settings, serp=serp)

    catalog = _build_tool_catalog(has_serp=serp is not None)
    system = _build_system(portfolio, trend, analytics, len(ranked_news), [t["name"] for t in catalog])
    messages: list[dict[str, Any]] = [*history, {"role": "user", "content": user_message}]

    tool_uses: list[dict[str, Any]] = []
    usage: dict[str, int] = {}

    try:
        with client.messages.stream(
            model=settings.reasoning_model,
            max_tokens=768,
            system=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
            tools=catalog,
            messages=messages,
        ) as stream:
            for event in stream:
                etype = getattr(event, "type", None)
                if etype == "content_block_start":
                    block = getattr(event, "content_block", None)
                    if block is not None and getattr(block, "type", None) == "tool_use":
                        yield {
                            "event": TOOL_CALL,
                            "data": {"id": block.id, "name": block.name, "status": "active"},
                        }
                elif etype == "content_block_delta":
                    delta = getattr(event, "delta", None)
                    if delta is None:
                        continue
                    if getattr(delta, "type", None) == "text_delta":
                        text = getattr(delta, "text", "") or ""
                        if text:
                            yield {"event": TEXT_DELTA, "data": {"text": text}}
                    # input_json_delta is ignored — args read from final message below.
            final = stream.get_final_message()
    except Exception as e:
        logger.exception("Chat stream failed")
        yield {"event": ERROR, "data": {"error": f"LLM call failed: {e}", "code": 502}}
        return

    for block in final.content:
        if getattr(block, "type", None) == "tool_use":
            tool_uses.append(
                {"id": block.id, "name": block.name, "input": block.input or {}}
            )

    try:
        usage = {
            "input_tokens": getattr(final.usage, "input_tokens", 0),
            "output_tokens": getattr(final.usage, "output_tokens", 0),
            "cache_read_input_tokens": getattr(final.usage, "cache_read_input_tokens", 0) or 0,
            "cache_creation_input_tokens": getattr(final.usage, "cache_creation_input_tokens", 0)
            or 0,
        }
    except Exception:
        usage = {}

    for tu in tool_uses:
        yield {"event": TOOL_CALL, "data": {"id": tu["id"], "name": tu["name"], "status": "done"}}
        yield from _dispatch(
            tu,
            deps=deps,
            portfolio=portfolio,
            portfolio_id=portfolio_id,
            trend=trend,
            analytics=analytics,
            ranked_news=ranked_news,
            advisor=advisor,
        )

    yield {
        "event": DONE,
        "data": {
            "usage": usage,
            "latency_ms": int((time.perf_counter() - t0) * 1000),
            "tool_calls": [tu["name"] for tu in tool_uses],
        },
    }


# ── Dispatch ─────────────────────────────────────────────────────────


def _dispatch(
    tu: dict[str, Any],
    *,
    deps: WorkflowDeps,
    portfolio,
    portfolio_id: str,
    trend,
    analytics,
    ranked_news,
    advisor: AdvisorAgent | None,
) -> Iterator[dict[str, Any]]:
    name = tu["name"]
    inp = tu["input"]

    if name == "show_market_snapshot":
        yield {"event": CARD, "data": {"kind": "market", "trend": trend.model_dump()}}
        return

    if name == "show_classified_news":
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
        return

    if name == "show_concentration_risk":
        yield {"event": CARD, "data": {"kind": "risk", "analytics": analytics.model_dump()}}
        return

    if name == "show_my_holdings_performance":
        holdings = [
            HoldingPerformance(
                symbol=h.symbol,
                sector=h.sector,
                weight_pct=h.weight_in_portfolio,
                day_change_pct=h.day_change_percent,
                day_change_abs=h.day_change,
                overall_gain_pct=h.gain_loss_percent,
                current_value=h.current_value,
            )
            for h in portfolio.holdings.stocks
        ]
        holdings.sort(key=lambda h: h.day_change_pct, reverse=True)
        card = HoldingsPerformanceCard(
            holdings=holdings,
            top_gainer=analytics.day_summary.top_gainer,
            top_loser=analytics.day_summary.top_loser,
            day_change_pct=analytics.day_summary.day_change_percent,
        )
        yield {"event": CARD, "data": {"kind": "holdings", **card.model_dump()}}
        return

    if name == "lookup_stock":
        yield from lookup_stock(str(inp.get("symbol", "")), deps=deps)
        return

    if name == "lookup_sector":
        yield from lookup_sector(str(inp.get("sector", "")), deps=deps)
        return

    if name == "scan_trends":
        yield from scan_trends(portfolio, deps=deps)
        return

    if name == "forecast_market":
        yield from forecast_market(deps=deps)
        return

    if name == "diagnose_stock":
        yield from diagnose_stock(str(inp.get("symbol", "")), deps=deps)
        return

    if name == "produce_briefing":
        yield {"event": BRIEFING_STARTED, "data": {"portfolio_id": portfolio_id}}
        if advisor is not None:
            yield from advisor.brief_stream(portfolio_id, top_news=8)
        return

    logger.warning("Unknown tool emitted by chat agent: %s", name)
    yield {"event": ERROR, "data": {"error": f"Unknown tool: {name}", "code": 500}}
