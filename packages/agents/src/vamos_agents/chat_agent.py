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
    compare_portfolio_to_market,
    diagnose_stock,
    explain_portfolio_move,
    forecast_market,
    lookup_market,
    lookup_sector,
    lookup_stock,
    scan_trends,
    show_my_mutual_funds,
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
        "FALLBACK ONLY — display the LOCAL (mock) market snapshot card. The "
        "loaded data is from a fixed date and may be stale. Use ONLY when "
        "lookup_market is not in the available tool list. When lookup_market "
        "is available, always prefer it for 'how's the market today' questions."
    ),
    "input_schema": {"type": "object", "properties": {}},
}

_TOOL_LOOKUP_MARKET = {
    "name": "lookup_market",
    "description": (
        "Pull a LIVE NIFTY 50 + SENSEX read from Google Finance with a one-line "
        "summary. Use for ANY 'how is the market doing today / right now' style "
        "question. Real-time, ~2-3 seconds. This is the preferred tool for "
        "broad market questions — never call show_market_snapshot if this tool "
        "is available."
    ),
    "input_schema": {"type": "object", "properties": {}},
}

_TOOL_SHOW_NEWS = {
    "name": "show_classified_news",
    "description": (
        "Display the ranked news card — today's headlines filtered by relevance "
        "to this portfolio. ALWAYS pass `focus` matching the user's framing: "
        "use 'negative' for 'what's hurting / dragging / why am I in loss / bad "
        "news', 'positive' for 'what's working / good news / why am I making "
        "money / what's driving gains', 'all' only for neutral 'show me the "
        "news' / 'what's the headline today'. Also pass a short `lead` sentence "
        "framing the result for the user (e.g. 'Here's what's pulling your "
        "book down today')."
    ),
    "input_schema": {
        "type": "object",
        "required": ["focus"],
        "properties": {
            "focus": {
                "type": "string",
                "enum": ["all", "negative", "positive", "neutral"],
                "description": "Sentiment slice. 'negative' = bearish only, 'positive' = bullish only, 'neutral' = mixed/neutral, 'all' = everything.",
            },
            "lead": {
                "type": "string",
                "description": "One short sentence (≤14 words) framing the filtered result for the user. Shown above the card.",
            },
        },
    },
}

_TOOL_SHOW_RISK = {
    "name": "show_concentration_risk",
    "description": (
        "Display the concentration-risk card — per-sector allocation, single-"
        "stock weights, and any alerts above the 40% / 20% thresholds. Use for "
        "ANY question about risk, concentration, exposure, diversification, "
        "vulnerability, 'where am I exposed', 'am I balanced', 'too much in one "
        "place', 'where can I get hit'. The same card answers all of these."
    ),
    "input_schema": {"type": "object", "properties": {}},
}

_TOOL_SHOW_HOLDINGS = {
    "name": "show_my_holdings_performance",
    "description": (
        "Display per-stock-holding day P&L — the user's stock positions ranked "
        "by today's move. ALWAYS pass `focus` matching the user's framing: "
        "'losers' for 'what's hurting / dragging / why am I in loss', 'gainers' "
        "for 'what's working / where are my gains', 'all' only for 'how are my "
        "stocks doing' / 'show my book'. Pass `lead` as a short framing "
        "sentence. Local data, no external calls. Does NOT cover mutual "
        "funds — use show_my_mutual_funds for those."
    ),
    "input_schema": {
        "type": "object",
        "required": ["focus"],
        "properties": {
            "focus": {
                "type": "string",
                "enum": ["all", "losers", "gainers"],
                "description": "Slice by today's move. 'losers' = down on the day only, 'gainers' = up only, 'all' = full ranked list.",
            },
            "lead": {
                "type": "string",
                "description": "One short sentence (≤14 words) framing the filtered result for the user.",
            },
        },
    },
}

_TOOL_SHOW_MFS = {
    "name": "show_my_mutual_funds",
    "description": (
        "Display the user's mutual-fund holdings — per-scheme weight, day "
        "change, overall returns, plus a one-line summary. Use for ANY MF "
        "question: 'how are my mutual funds doing', 'why is my MF slow / not "
        "moving', 'why is my fund different from stocks', 'what's driving my "
        "fund returns'. Local data only."
    ),
    "input_schema": {"type": "object", "properties": {}},
}

_TOOL_EXPLAIN_MOVE = {
    "name": "explain_portfolio_move",
    "description": (
        "Lightweight 3–4 sentence text explanation of why the user's portfolio "
        "moved today. Uses local holdings + market trend + ranked news. Cheap "
        "(~1s, single Haiku call), no card, no evaluator. Use for: 'why is my "
        "portfolio moving / up / down', 'what's happening to my money', 'what's "
        "going on with my investments', 'why am I in loss / making money', "
        "'what's pushing my portfolio', 'what changed today', 'what's the main "
        "thing for me today'. Do NOT use for portfolio-wide deep causal "
        "questions that explicitly ask for a 'briefing' or 'full causal chain' "
        "— those go to produce_briefing. Do NOT use for single-stock 'why' "
        "questions — use diagnose_stock."
    ),
    "input_schema": {"type": "object", "properties": {}},
}

_TOOL_COMPARE = {
    "name": "compare_portfolio_to_market",
    "description": (
        "Text-only comparison: portfolio day change vs. market (NIFTY/SENSEX) "
        "average, plus the sector / holding mix that explains any gap. Use for "
        "'market is up but I'm not', 'why am I lagging the market', 'why my "
        "portfolio not matching market', 'why am I not benefiting from market "
        "move'. Local data only, ~1s."
    ),
    "input_schema": {"type": "object", "properties": {}},
}

_TOOL_LOOKUP_STOCK = {
    "name": "lookup_stock",
    "description": (
        "Fetch a live quote for a single named stock from Google Finance. "
        "Use for 'how is INFY performing', 'price of TCS', or 'what's HDFCBANK "
        "trading at'. Do NOT use this to explain WHY a stock moved — call "
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
        "Scan the user's stock holdings for 5-day and 20-day momentum, "
        "splitting into top up- and down-movers. Use when the user asks about "
        "trends, momentum, 'what's going up/down in my book', or recent winners "
        "and losers across the portfolio."
    ),
    "input_schema": {"type": "object", "properties": {}},
}

_TOOL_FORECAST = {
    "name": "forecast_market",
    "description": (
        "Run the market-wide forecast pipeline — Google News ranking + NIFTY "
        "50 historical graph from Google Finance → directional outlook. Use "
        "ONLY when the user asks 'where is the market headed', 'future', "
        "'predict', 'outlook', or other explicitly forward-looking questions. "
        "Multi-step (~5-8s); never use it for a simple 'how is the market today' "
        "— that goes to show_market_snapshot."
    ),
    "input_schema": {"type": "object", "properties": {}},
}

_TOOL_DIAGNOSE_STOCK = {
    "name": "diagnose_stock",
    "description": (
        "Run the stock-diagnosis pipeline for one named stock — live quote + "
        "news + Haiku reasoning over the headlines. Use for 'why is INFY down', "
        "'what happened to TCS', 'is there news on RELIANCE', 'should I worry "
        "about HDFCBANK'. The model will say plainly if no news supports the "
        "move. Do NOT use for portfolio-wide 'why did my portfolio move' — call "
        "explain_portfolio_move (cheap) or produce_briefing (deep)."
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
        "Run the FULL causal briefing pipeline — maps news to sectors to held "
        "stocks to portfolio impact, with conflict flags, confidence score, "
        "and self-evaluation. Heavy (~5-10s) and produces a structured card "
        "with causal chains. Use ONLY when the user explicitly asks for a "
        "briefing, full causal chain, deep analysis, or 'trace exactly how X "
        "reached my portfolio'. For casual 'why is my portfolio moving' use "
        "explain_portfolio_move instead — same answer in 1s with no card."
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
        _TOOL_SHOW_MFS,
        _TOOL_EXPLAIN_MOVE,
        _TOOL_COMPARE,
        _TOOL_PRODUCE_BRIEFING,
    ]
    if has_serp:
        tools.extend(
            [
                _TOOL_LOOKUP_MARKET,
                _TOOL_LOOKUP_STOCK,
                _TOOL_LOOKUP_SECTOR,
                _TOOL_SCAN_TRENDS,
                _TOOL_FORECAST,
                _TOOL_DIAGNOSE_STOCK,
            ]
        )
    return tools


def _build_system(portfolio, trend, analytics, news_count: int, available: list[str], snapshot_date: str) -> str:
    alerts = ""
    if analytics.concentration_risk and analytics.alerts:
        alerts = " · ALERT: " + "; ".join(
            f"{a.name} {a.weight_percent:.0f}%" for a in analytics.alerts
        )
    held_stocks = ", ".join(h.symbol for h in portfolio.holdings.stocks) or "(none)"
    held_sectors = ", ".join(sorted({h.sector for h in portfolio.holdings.stocks})) or "(none)"
    has_mfs = "yes" if portfolio.holdings.mutual_funds else "no"
    tool_lines = "\n".join(f"- {name}" for name in available)
    first_name = portfolio.user_name.split()[0]
    has_live_market = "lookup_market" in available

    market_routing = (
        "  → lookup_market (LIVE — preferred when this tool is available)"
        if has_live_market
        else "  → show_market_snapshot (local, may be slightly dated)"
    )
    stock_routing = (
        "  → lookup_stock(symbol=...) for 'how is X doing' / 'price of X' (LIVE)"
        if "lookup_stock" in available
        else "  → (live stock quotes not available this turn — say so)"
    )
    diagnose_routing = (
        "  → diagnose_stock(symbol=...) for 'why is X moving' / 'news on X'"
        if "diagnose_stock" in available
        else "  → (single-stock diagnosis not available this turn)"
    )

    return f"""You are Aarthik — an autonomous financial advisor for Indian markets.

You're speaking with {portfolio.user_name} (portfolio: {portfolio.portfolio_type.value.lower().replace("_", " ")}, risk: {portfolio.risk_profile.value.lower()}).

Local snapshot (mock data; may be older than today): as of {snapshot_date}
- Market sentiment: {trend.overall_sentiment.value} ({trend.avg_broad_change:+.2f}% broad avg across NIFTY50/SENSEX)
- Advancing sectors: {trend.advancing_sectors} / Declining: {trend.declining_sectors}
- Portfolio day P&L: {analytics.day_summary.day_change_percent:+.2f}% ({analytics.day_summary.day_change_absolute:+,.0f} INR){alerts}
- Relevant news: {news_count} articles ranked by portfolio exposure

User holds these stocks: {held_stocks}
Across these sectors: {held_sectors}
Mutual funds in portfolio: {has_mfs}

Tools available this turn:
{tool_lines}

## Hard rules (no exceptions)

1. **EXACTLY ONE tool per turn.** Never two. If the user seems to ask two things,
   pick the more important one and address the other in your text reply. Multiple
   tool calls in one response are forbidden.

2. **Each user message is INDEPENDENT.** Do NOT carry topics forward. If the
   user previously asked about INFY and now asks "how's the market today",
   answer ONLY the market question. Do not re-call diagnose_stock or
   lookup_stock for INFY. The new question replaces the old context.

3. **If you already showed something in a past turn, don't show it again** unless
   the user explicitly asks you to refresh it.

## Routing — match the user's intent, ignore prior turns

Broad market ("how's the market today" / "what's happening" / "why up/down" / "stocks today" / "market summary"):
{market_routing}

News-driven market ("what's driving today" / "biggest events" / "headlines today"):
  → show_classified_news

Forward-looking market ("where is the market headed" / "predict" / "future" / "outlook"):
  → forecast_market

Portfolio impact / loss / gain (most common user question):
- "why is my portfolio moving / up / down / in loss / making money"
- "what's happening to my money" / "what's hurting / dragging me"
- "what worked today" / "where are my gains coming from"
- "what's the main thing for me today" / "what should I focus on"
- "should I care / worry / act" / "is this a big deal"
- "did I miss something" / "anything impacting my portfolio"
  → explain_portfolio_move

Market vs portfolio mismatch ("market is up but I'm not" / "why lagging"):
  → compare_portfolio_to_market

Holdings table ("how are my stocks doing" / "which positions moved"):
  → show_my_holdings_performance

Mutual funds (any MF question):
  → show_my_mutual_funds

Risk / diversification / exposure / vulnerability:
- "am I too exposed / risky / concentrated / dangerous"
- "am I balanced / diversified / spread out" / "is my allocation skewed"
  → show_concentration_risk

Single-stock quote questions:
{stock_routing}

Single-stock 'why' questions:
{diagnose_routing}

Sector questions ("how is IT / banking / pharma doing"):
  → lookup_sector(sector=...)

Trend / momentum scans across the book:
  → scan_trends

Full causal briefing (heavy — only on explicit ask):
  → produce_briefing

Greetings / "thanks" / small talk → 1–2 warm sentences, NO tools.

## Filtering — match the user's framing

For `show_classified_news` and `show_my_holdings_performance`, you MUST pass a
`focus` argument that matches how the user framed their question:

- "what's hurting / dragging me / why am I in loss / bad news / negative" →
    show_classified_news(focus="negative") OR show_my_holdings_performance(focus="losers")
- "what's working / where are my gains / good news / positive" →
    show_classified_news(focus="positive") OR show_my_holdings_performance(focus="gainers")
- "show me the news / how are my stocks doing" (neutral framing) →
    focus="all"

Always pass a short `lead` (≤14 words) framing the result. Examples:
- focus=negative, lead="Here's what's pulling your book down today."
- focus=losers, lead="These are your three positions in the red right now."
- focus=all, lead="Today's portfolio-relevant headlines, ranked."

NEVER show all news/holdings when the user asked specifically about negatives
or positives — it surfaces noise and dilutes the answer.

## Anti-hallucination — hard rules

1. NEVER invent news, catalysts, earnings, or announcements. If the news feed
   doesn't show something, say "Nothing significant in today's feed for that."
2. NEVER cite a stock that isn't in the user's holdings unless they named it
   themselves. Held stocks: {held_stocks}.
3. If a tool returns "data unavailable", relay that honestly.
4. Numbers must come from the data above or a tool result — never invent.
5. The local snapshot is dated {snapshot_date}. If the user implies "right now"
   or "today" and that date isn't today, prefer LIVE tools (lookup_market,
   lookup_stock, diagnose_stock, lookup_sector) when available.

## Style

- Tool call + ONE short framing sentence ("Sure — pulling that up."). Don't
  pre-empt the answer; the tool IS the answer.
- Use first name ({first_name}) sparingly.
- If you can't answer, say so in one sentence and suggest a concrete reframe.

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
    system = _build_system(
        portfolio,
        trend,
        analytics,
        len(ranked_news),
        [t["name"] for t in catalog],
        snapshot.date,
    )
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
        yield {
            "event": CARD,
            "data": {
                "kind": "note",
                "tone": "negative",
                "text": (
                    "I hit a hiccup reaching the model just now. Give it a moment "
                    "and try again — if it keeps happening, the API key may be "
                    "rate-limited or unset."
                ),
            },
        }
        yield {"event": DONE, "data": {"usage": {}, "latency_ms": int((time.perf_counter() - t0) * 1000), "tool_calls": []}}
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

    # Hard cap: dispatch ONLY the first tool Claude picked, even if it picked
    # multiple. The system prompt forbids multi-tool turns; this is the safety
    # net so a model slip doesn't surface a duplicate / off-topic card to the
    # user. If Claude returned multiple tool_uses, log it and drop the rest.
    if len(tool_uses) > 1:
        dropped = [tu["name"] for tu in tool_uses[1:]]
        logger.warning(
            "Claude picked %d tools in one turn; dispatching only %s, dropping %s",
            len(tool_uses),
            tool_uses[0]["name"],
            dropped,
        )

    dispatched: list[str] = []
    for tu in tool_uses[:1]:
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
        dispatched.append(tu["name"])

    yield {
        "event": DONE,
        "data": {
            "usage": usage,
            "latency_ms": int((time.perf_counter() - t0) * 1000),
            "tool_calls": dispatched,
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
        focus = str(inp.get("focus", "all")).lower()
        lead = str(inp.get("lead", "")).strip()
        items = ranked_news
        if focus == "negative":
            items = [r for r in items if r.article.sentiment.value.upper() in ("NEGATIVE", "BEARISH")]
        elif focus == "positive":
            items = [r for r in items if r.article.sentiment.value.upper() in ("POSITIVE", "BULLISH")]
        elif focus == "neutral":
            items = [r for r in items if r.article.sentiment.value.upper() == "NEUTRAL"]
        # if no items match the filter, fall back to a friendly note instead of empty card
        if not items and focus != "all":
            yield {
                "event": CARD,
                "data": {
                    "kind": "note",
                    "tone": "neutral",
                    "text": (
                        f"Nothing in today's feed matches '{focus}' for your portfolio. "
                        "Want me to show the full ranked news instead?"
                    ),
                },
            }
            return
        yield {
            "event": CARD,
            "data": {
                "kind": "news",
                "focus": focus,
                "lead": lead,
                "news": [
                    {
                        "relevance_score": r.relevance_score,
                        "matched_sectors": r.matched_sectors,
                        "matched_stocks": r.matched_stocks,
                        "portfolio_exposure_pct": r.portfolio_exposure_pct,
                        "why_relevant": r.reason,
                        "article": r.article.model_dump(),
                    }
                    for r in items
                ],
            },
        }
        return

    if name == "show_concentration_risk":
        yield {"event": CARD, "data": {"kind": "risk", "analytics": analytics.model_dump()}}
        return

    if name == "show_my_holdings_performance":
        focus = str(inp.get("focus", "all")).lower()
        lead = str(inp.get("lead", "")).strip()
        if not portfolio.holdings.stocks:
            yield {
                "event": CARD,
                "data": {
                    "kind": "note",
                    "tone": "neutral",
                    "text": "You don't have any direct stock holdings — only mutual funds.",
                },
            }
            return
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
        if focus == "losers":
            holdings = [h for h in holdings if h.day_change_pct < 0]
            holdings.sort(key=lambda h: h.day_change_pct)
        elif focus == "gainers":
            holdings = [h for h in holdings if h.day_change_pct > 0]
            holdings.sort(key=lambda h: h.day_change_pct, reverse=True)
        else:
            holdings.sort(key=lambda h: h.day_change_pct, reverse=True)
        if not holdings and focus != "all":
            yield {
                "event": CARD,
                "data": {
                    "kind": "note",
                    "tone": "neutral",
                    "text": (
                        f"None of your holdings are in the {focus} bucket today — "
                        "want me to show your full positions instead?"
                    ),
                },
            }
            return
        card_obj = HoldingsPerformanceCard(
            holdings=holdings,
            top_gainer=analytics.day_summary.top_gainer,
            top_loser=analytics.day_summary.top_loser,
            day_change_pct=analytics.day_summary.day_change_percent,
        )
        yield {
            "event": CARD,
            "data": {
                "kind": "holdings",
                "focus": focus,
                "lead": lead,
                **card_obj.model_dump(),
            },
        }
        return

    if name == "show_my_mutual_funds":
        yield from show_my_mutual_funds(portfolio)
        return

    if name == "explain_portfolio_move":
        yield from explain_portfolio_move(
            portfolio,
            trend=trend,
            analytics=analytics,
            ranked_news=ranked_news,
            deps=deps,
        )
        return

    if name == "compare_portfolio_to_market":
        yield from compare_portfolio_to_market(
            portfolio,
            trend=trend,
            analytics=analytics,
            ranked_news=ranked_news,
            deps=deps,
        )
        return

    if name == "lookup_market":
        yield from lookup_market(deps=deps)
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
    yield {
        "event": CARD,
        "data": {
            "kind": "note",
            "tone": "negative",
            "text": f"I tried to use a tool ({name}) I don't have wired up. Please try rephrasing.",
        },
    }
