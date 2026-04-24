"""Single-stock workflows — SerpApi (google_finance + google_news).

``lookup_stock``    — one-shot live quote card (google_finance).
``diagnose_stock``  — three-step "why is X moving" pipeline:
    1. check_current_stock_status   (google_finance quote)
    2. stock_status_reasoning       (google_news + Haiku reasoning)
    3. compile_final_output         (assemble StockDiagnosis card)
"""

from __future__ import annotations

import logging
import time
from typing import Iterator

from vamos_agents.providers import ProviderError, finance_query
from vamos_agents.workflows._deps import WorkflowDeps
from vamos_agents.workflows._events import card, error, tool_done, tool_start
from vamos_agents.workflows.schemas import NewsRef, StockDiagnosis, StockQuote

logger = logging.getLogger(__name__)


def lookup_stock(symbol: str, *, deps: WorkflowDeps) -> Iterator[dict]:
    sym = symbol.upper().strip()
    if not sym:
        yield error("lookup_stock requires a symbol", code=400)
        return
    if deps.serp is None:
        yield error("SERPAPI_KEY not set — stock lookup unavailable", code=503)
        return

    ts = time.perf_counter()
    yield tool_start("fetch_quote", "Fetching live quote", sym)
    try:
        raw = deps.serp.google_finance(finance_query(sym))
    except ProviderError as e:
        yield tool_done("fetch_quote", ts)
        yield error(str(e))
        return
    quote = StockQuote.from_serpapi_finance(sym, raw)
    yield tool_done("fetch_quote", ts)

    ts = time.perf_counter()
    yield tool_start("summarize_quote", "Writing summary", sym)
    summary = _haiku_quote_summary(deps, sym, quote)
    yield tool_done("summarize_quote", ts)

    yield card("stock", {"quote": quote.model_dump(), "summary": summary})


def diagnose_stock(symbol: str, *, deps: WorkflowDeps) -> Iterator[dict]:
    sym = symbol.upper().strip()
    if not sym:
        yield error("diagnose_stock requires a symbol", code=400)
        return
    if deps.serp is None:
        yield error("SERPAPI_KEY not set — diagnosis unavailable", code=503)
        return

    # 1. live quote
    ts = time.perf_counter()
    yield tool_start(
        "check_current_stock_status",
        "Checking current stock status",
        f"{sym} live quote",
    )
    try:
        raw_quote = deps.serp.google_finance(finance_query(sym))
    except ProviderError as e:
        yield tool_done("check_current_stock_status", ts)
        yield error(str(e))
        return
    quote = StockQuote.from_serpapi_finance(sym, raw_quote)
    yield tool_done("check_current_stock_status", ts)

    # 2. news + reasoning
    ts = time.perf_counter()
    yield tool_start("stock_status_reasoning", "Reasoning over news + price", f"{sym} headlines")
    try:
        news_raw = deps.serp.search_news(f"{sym} stock NSE India", num=10)
    except ProviderError as e:
        yield tool_done("stock_status_reasoning", ts)
        yield error(str(e))
        return
    headlines = [NewsRef(**n) for n in news_raw]
    reasoning = _haiku_explain(deps, sym, quote, headlines)
    yield tool_done("stock_status_reasoning", ts)

    # 3. compile
    ts = time.perf_counter()
    yield tool_start("compile_final_output", "Compiling diagnosis", sym)
    diagnosis = StockDiagnosis(
        symbol=sym,
        quote=quote,
        headlines=headlines,
        reasoning=reasoning,
        summary=_one_line_summary(quote, reasoning),
    )
    yield tool_done("compile_final_output", ts)
    yield card("stock_diagnosis", {"diagnosis": diagnosis.model_dump()})


def _haiku_quote_summary(deps: WorkflowDeps, sym: str, quote: StockQuote) -> str:
    """2–3 sentence plain-English read of just the quote (no news)."""
    if quote.price is None or quote.change_pct is None:
        return f"{sym}: live quote unavailable right now."
    if not deps.settings.anthropic_api_key:
        return _fallback_quote_summary(sym, quote)
    user = (
        f"Stock: {sym} ({quote.title or ''})\n"
        f"Price: {quote.price} {quote.currency or ''}\n"
        f"Today's change: {quote.change_pct:+.2f}%\n\n"
        "Write 2–3 sentences answering 'how is this stock doing today'. State "
        "the direction and magnitude in plain English (e.g. 'sharp drop', "
        "'modest gain'), call out anything notable about the size of the move "
        "(>3% is large, >5% is sharp), and say this is the live quote — no "
        "news context unless the user asks. No disclaimers, no advice."
    )
    try:
        resp = deps.anthropic.messages.create(
            model=deps.settings.eval_model,
            max_tokens=200,
            system="You are a sober equity analyst. No fluff, no disclaimers.",
            messages=[{"role": "user", "content": user}],
        )
        return _join_text(resp).strip() or _fallback_quote_summary(sym, quote)
    except Exception as e:
        logger.warning("Haiku quote summary failed for %s: %s", sym, e)
        return _fallback_quote_summary(sym, quote)


def _fallback_quote_summary(sym: str, quote: StockQuote) -> str:
    pct = quote.change_pct or 0.0
    direction = "down" if pct < 0 else "up"
    price = f"{quote.price:.2f} {quote.currency or ''}".strip()
    return f"{sym} is trading at {price}, {direction} {abs(pct):.2f}% today."


def _haiku_explain(
    deps: WorkflowDeps, sym: str, quote: StockQuote, headlines: list[NewsRef]
) -> str:
    if not deps.settings.anthropic_api_key:
        return _fallback_reasoning(sym, quote, headlines)
    if not headlines:
        return f"No fresh news found for {sym}; cannot attribute today's move to a specific catalyst."
    bullets = "\n".join(f"- {h.title} ({h.source}, {h.date})" for h in headlines[:8])
    pct = quote.change_pct if quote.change_pct is not None else 0.0
    user = (
        f"Stock: {sym}\n"
        f"Price: {quote.price} ({pct:+.2f}% today)\n\n"
        f"Top news:\n{bullets}\n\n"
        "In 3–5 sentences, explain the most plausible reasons for today's move based "
        "ONLY on these headlines and the price action. If the news doesn't explain it, "
        "say so plainly. No speculation."
    )
    try:
        resp = deps.anthropic.messages.create(
            model=deps.settings.eval_model,
            max_tokens=400,
            system="You are a sober equity analyst. No fluff, no disclaimers.",
            messages=[{"role": "user", "content": user}],
        )
        return _join_text(resp).strip() or _fallback_reasoning(sym, quote, headlines)
    except Exception as e:
        logger.warning("Haiku stock reasoning failed for %s: %s", sym, e)
        return _fallback_reasoning(sym, quote, headlines)


def _fallback_reasoning(sym: str, quote: StockQuote, headlines: list[NewsRef]) -> str:
    pct = quote.change_pct if quote.change_pct is not None else 0.0
    if not headlines:
        return f"{sym} moved {pct:+.2f}% today; no news context available."
    return (
        f"{sym} moved {pct:+.2f}% today. Most-cited headline: "
        f'"{headlines[0].title}" ({headlines[0].source}).'
    )


def _one_line_summary(quote: StockQuote, reasoning: str) -> str:
    direction = "down" if (quote.change_pct or 0) < 0 else "up"
    pct = abs(quote.change_pct or 0)
    first = reasoning.split(".")[0].strip() if reasoning else ""
    base = f"{quote.symbol} {direction} {pct:.2f}%"
    return f"{base} — {first}." if first else f"{base}."


def _join_text(resp) -> str:
    return "".join(b.text for b in resp.content if getattr(b, "type", None) == "text")
