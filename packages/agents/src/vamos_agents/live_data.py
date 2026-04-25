"""Live-data enrichment: replace mock prices and mock news with SerpApi.

Two responsibilities:

1. ``enrich_portfolio_with_live_quotes`` — for each stock holding, fetch a
   live Google Finance quote and overwrite ``current_price``,
   ``current_value``, ``day_change``, ``day_change_percent``, ``gain_loss``,
   ``gain_loss_percent``, and ``weight_in_portfolio``. Mutual-fund NAVs
   stay mock (no clean live source via SerpApi for Indian MF schemes).

2. ``fetch_live_news`` — replace ``news_data.json`` with live Google News
   results, classified via a single Haiku batch call (sentiment, scope,
   impact, entities, causal_factors). Cached so we don't re-classify on
   every turn.

Both fall back gracefully: if SerpApi or Haiku misbehaves, we keep the mock
data so the app stays usable rather than dying.
"""

from __future__ import annotations

import concurrent.futures
import hashlib
import json
import logging
import re
import time
from typing import Any

from anthropic import Anthropic

from vamos_core.schemas.common import ImpactLevel, NewsScope, Sentiment
from vamos_core.schemas.news import NewsArticle, NewsEntities
from vamos_core.schemas.portfolio import (
    Holdings,
    MutualFundHolding,
    Portfolio,
    StockHolding,
)

from vamos_agents.providers import (
    ProviderError,
    SerpApiClient,
    finance_query,
)
from vamos_agents.settings import Settings

logger = logging.getLogger(__name__)


# ── Module-level caches (TTL) ────────────────────────────────────────
#
# Quotes share the SerpApi client's own TTL cache (5 min by default).
# News classification is expensive (one LLM call), so we cache the final
# classified list per (portfolio_id, query_set) for ``_NEWS_TTL_S``.

_NEWS_TTL_S = 600  # 10 minutes — enough to cover a normal session
_news_cache: dict[str, tuple[float, list[NewsArticle]]] = {}


# ── Portfolio enrichment ─────────────────────────────────────────────


def enrich_portfolio_with_live_quotes(
    portfolio: Portfolio, *, serp: SerpApiClient | None
) -> tuple[Portfolio, bool]:
    """Return a copy of ``portfolio`` with stock holdings updated to live quotes.

    Returns ``(portfolio, is_live)`` where ``is_live`` is True iff at least
    one holding was successfully refreshed from live data.

    Mutual funds are passed through unchanged.
    """
    if serp is None or not portfolio.holdings.stocks:
        return portfolio, False

    symbols = [h.symbol for h in portfolio.holdings.stocks]
    quotes = _fetch_quotes_parallel(symbols, serp=serp)
    if not any(q is not None for q in quotes.values()):
        return portfolio, False

    new_stocks: list[StockHolding] = []
    refreshed = 0

    # Recompute current values per holding from live prices first; then
    # recompute weights against the new total.
    for h in portfolio.holdings.stocks:
        live = quotes.get(h.symbol)
        if live is None or live.get("price") is None:
            new_stocks.append(h)
            continue
        price: float = float(live["price"])
        change_pct: float = float(live.get("change_pct") or 0.0)
        prev_price = price / (1 + change_pct / 100.0) if change_pct != -100 else h.current_price
        day_change_per_share = price - prev_price
        new_current_value = price * h.quantity
        new_day_change = day_change_per_share * h.quantity
        new_gain_loss = new_current_value - h.investment_value
        new_gain_loss_pct = (
            new_gain_loss / h.investment_value * 100.0 if h.investment_value else 0.0
        )

        new_stocks.append(
            h.model_copy(
                update={
                    "current_price": round(price, 2),
                    "current_value": round(new_current_value, 2),
                    "day_change": round(new_day_change, 2),
                    "day_change_percent": round(change_pct, 2),
                    "gain_loss": round(new_gain_loss, 2),
                    "gain_loss_percent": round(new_gain_loss_pct, 2),
                    # weight gets recomputed below once we know the new total
                    "weight_in_portfolio": h.weight_in_portfolio,
                }
            )
        )
        refreshed += 1

    # Recompute weights against the new total portfolio value (stocks + MFs).
    mfs: list[MutualFundHolding] = list(portfolio.holdings.mutual_funds)
    new_total = sum(s.current_value for s in new_stocks) + sum(m.current_value for m in mfs)
    if new_total > 0:
        new_stocks = [
            s.model_copy(
                update={"weight_in_portfolio": round(s.current_value / new_total * 100, 2)}
            )
            for s in new_stocks
        ]

    new_overall_gain = sum(s.gain_loss for s in new_stocks) + sum(m.gain_loss for m in mfs)
    new_total_invested = portfolio.total_investment  # buy basis doesn't change
    new_overall_gain_pct = (
        new_overall_gain / new_total_invested * 100.0 if new_total_invested else 0.0
    )

    enriched = portfolio.model_copy(
        update={
            "holdings": Holdings(stocks=new_stocks, mutual_funds=mfs),
            "current_value": round(new_total, 2),
            "overall_gain_loss": round(new_overall_gain, 2),
            "overall_gain_loss_percent": round(new_overall_gain_pct, 2),
        }
    )
    logger.info("Portfolio %s enriched: %d/%d holdings refreshed live",
                portfolio.portfolio_id, refreshed, len(portfolio.holdings.stocks))
    return enriched, refreshed > 0


def _fetch_quotes_parallel(
    symbols: list[str], *, serp: SerpApiClient
) -> dict[str, dict[str, Any] | None]:
    """Hit SerpApi google_finance for each symbol in parallel. Returns a
    dict of symbol → {"price", "change_pct"} (or None on failure). Uses the
    client's built-in TTL cache so back-to-back turns are free."""
    results: dict[str, dict[str, Any] | None] = {s: None for s in symbols}

    def _one(sym: str) -> tuple[str, dict[str, Any] | None]:
        try:
            raw = serp.google_finance(finance_query(sym))
        except ProviderError as e:
            logger.warning("live quote %s failed: %s", sym, e)
            return sym, None
        summary = raw.get("summary") or {}
        movement = summary.get("price_movement") or {}
        price = _to_float(summary.get("extracted_price"))
        pct = _to_float(movement.get("percentage"))
        if pct is not None:
            direction = str(movement.get("movement", "")).lower()
            pct = -abs(pct) if direction == "down" else abs(pct)
        if price is None:
            return sym, None
        return sym, {"price": price, "change_pct": pct}

    # 8 holdings * ~1s/call → ~1.5s with 8 workers; SerpApi handles parallel fine.
    with concurrent.futures.ThreadPoolExecutor(max_workers=min(len(symbols), 8)) as pool:
        for sym, payload in pool.map(_one, symbols):
            results[sym] = payload
    return results


def _to_float(v: Any) -> float | None:
    if v in (None, ""):
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


# ── Live news ─────────────────────────────────────────────────────────


_NEWS_QUERIES: list[str] = [
    "Indian stock market NIFTY today",
    "Indian stock market top news today",
    "NSE BSE earnings results today",
    "Indian banking sector news today",
    "Indian IT sector news today",
]


def fetch_live_news(
    portfolio: Portfolio,
    *,
    serp: SerpApiClient | None,
    anthropic: Anthropic | None,
    settings: Settings,
    fallback: list[NewsArticle],
) -> tuple[list[NewsArticle], bool]:
    """Fetch + classify live news. Returns ``(articles, is_live)``.

    Cached for 10 minutes per portfolio. Falls back to ``fallback`` (the
    mock list) if SerpApi or Haiku is unavailable / errors out.
    """
    if serp is None or anthropic is None or not settings.anthropic_api_key:
        return fallback, False

    cache_key = portfolio.portfolio_id
    cached = _news_cache.get(cache_key)
    if cached and (time.time() - cached[0]) < _NEWS_TTL_S:
        logger.info("Live news cache hit for %s", portfolio.portfolio_id)
        return cached[1], True

    held_stocks = [h.symbol for h in portfolio.holdings.stocks]
    sectors = sorted({h.sector for h in portfolio.holdings.stocks})

    raw_items = _gather_raw_news(serp, held_stocks)
    if not raw_items:
        return fallback, False

    classified = _classify_news_batch(
        raw_items, anthropic, settings, held_stocks=held_stocks, sectors=sectors
    )
    if not classified:
        return fallback, False

    _news_cache[cache_key] = (time.time(), classified)
    logger.info("Live news for %s: %d articles", portfolio.portfolio_id, len(classified))
    return classified, True


_MAX_NEWS_ARTICLES = 18  # caps Haiku classifier output to fit comfortably in 8K tokens


def _gather_raw_news(serp: SerpApiClient, held_stocks: list[str]) -> list[dict[str, Any]]:
    """Run several SerpApi google_news queries in parallel and dedupe."""
    queries = list(_NEWS_QUERIES)
    # Add per-holding queries for the top 3 weighted stocks (already passed
    # in symbol-only). We keep this small to stay under the SerpApi quota.
    for sym in held_stocks[:3]:
        queries.append(f"{sym} stock NSE India today")

    seen_urls: set[str] = set()
    out: list[dict[str, Any]] = []

    def _one(q: str) -> list[dict[str, Any]]:
        try:
            return serp.search_news(q, num=6)
        except ProviderError as e:
            logger.warning("live news query '%s' failed: %s", q, e)
            return []

    with concurrent.futures.ThreadPoolExecutor(max_workers=min(len(queries), 6)) as pool:
        for items in pool.map(_one, queries):
            for it in items:
                url = (it.get("url") or "").strip()
                if not url or url in seen_urls:
                    continue
                seen_urls.add(url)
                out.append(it)
                if len(out) >= _MAX_NEWS_ARTICLES:
                    return out
    return out


_CLASSIFY_SYSTEM = (
    "You classify financial news articles for an Indian-equities advisor. "
    "Strict JSON only. Never invent. If a field can't be determined from the "
    "headline + snippet, use a conservative default (NEUTRAL / MARKET_WIDE / LOW)."
)


def _classify_news_batch(
    items: list[dict[str, Any]],
    anthropic: Anthropic,
    settings: Settings,
    *,
    held_stocks: list[str],
    sectors: list[str],
) -> list[NewsArticle]:
    """Single Haiku call to classify all headlines into the NewsArticle schema."""
    indexed = list(enumerate(items))
    payload_lines = []
    for i, it in indexed:
        title = (it.get("title") or "").replace("\n", " ").strip()
        snippet = (it.get("snippet") or "").replace("\n", " ").strip()[:240]
        payload_lines.append(f"[{i}] {title} || {snippet}")
    bulk = "\n".join(payload_lines)

    user = f"""Classify each headline below. Return STRICT JSON: a JSON array of
objects, one per headline, in the same order as the input indexes.

Schema per object:
{{
  "id": "<index as string>",
  "headline": "<original headline, trimmed>",
  "summary": "<one-sentence neutral summary, ≤200 chars>",
  "sentiment": "BULLISH" | "BEARISH" | "NEUTRAL" | "MIXED",
  "sentiment_score": <float between -1 and 1>,
  "scope": "MARKET_WIDE" | "SECTOR_SPECIFIC" | "STOCK_SPECIFIC",
  "impact_level": "HIGH" | "MEDIUM" | "LOW",
  "entities": {{
    "sectors": [<strings drawn from {sectors}>],
    "stocks":  [<NSE tickers from {held_stocks} only — do NOT invent>],
    "indices": [<"NIFTY50" / "SENSEX" / etc. only if mentioned>],
    "keywords": [<3-5 free-form domain keywords>]
  }},
  "causal_factors": [<1-2 short causal phrases like "rate cut hopes", "Q4 results">]
}}

Rules:
- Only include sectors from this list: {sectors}.
- Only include stocks from this list: {held_stocks}.
- If neither is mentioned, leave both arrays empty (scope becomes MARKET_WIDE).
- impact_level: HIGH = clearly market-/holding-moving, MEDIUM = relevant context, LOW = noise.

Input headlines (index || title || snippet):
{bulk}

Return ONLY the JSON array. No prose, no markdown fences.
"""

    try:
        resp = anthropic.messages.create(
            model=settings.eval_model,
            max_tokens=8192,
            system=_CLASSIFY_SYSTEM,
            messages=[{"role": "user", "content": user}],
        )
        text = "".join(b.text for b in resp.content if getattr(b, "type", None) == "text").strip()
        # Strip ``` fences if Claude added them despite instructions
        text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.MULTILINE).strip()
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            # Recover from a truncated array: trim back to the last complete
            # object, then re-close the array. Better to keep N classified
            # items than throw the whole batch away.
            data = _salvage_truncated_json_array(text)
            if data is None:
                raise
        if not isinstance(data, list):
            raise ValueError("Classifier did not return a JSON array")
    except Exception as e:
        logger.warning("News classification failed: %s", e)
        return []

    out: list[NewsArticle] = []
    for i, raw in enumerate(data):
        if not isinstance(raw, dict):
            continue
        try:
            src = items[i] if i < len(items) else {}
            article = NewsArticle(
                id=_stable_id(src.get("url", ""), raw.get("headline", "")),
                headline=str(raw.get("headline", "")).strip()[:300],
                summary=str(raw.get("summary", "")).strip()[:400],
                published_at=str(src.get("date", "") or ""),
                source=str(src.get("source", "")).strip()[:80],
                sentiment=_safe_enum(Sentiment, raw.get("sentiment"), Sentiment.NEUTRAL),
                sentiment_score=_clip(float(raw.get("sentiment_score") or 0.0), -1.0, 1.0),
                scope=_safe_enum(NewsScope, raw.get("scope"), NewsScope.MARKET_WIDE),
                impact_level=_safe_enum(ImpactLevel, raw.get("impact_level"), ImpactLevel.LOW),
                entities=NewsEntities(
                    sectors=[s for s in (raw.get("entities", {}).get("sectors") or []) if s in sectors],
                    stocks=[s for s in (raw.get("entities", {}).get("stocks") or []) if s in held_stocks],
                    indices=list(raw.get("entities", {}).get("indices") or []),
                    keywords=list(raw.get("entities", {}).get("keywords") or [])[:5],
                ),
                causal_factors=list(raw.get("causal_factors") or [])[:3],
            )
            out.append(article)
        except Exception as e:
            logger.debug("Skipping malformed classified item %d: %s", i, e)
            continue
    return out


def _salvage_truncated_json_array(text: str) -> list[Any] | None:
    """Best-effort recovery of a truncated JSON array.

    Walks the string keeping a brace/bracket depth counter, finds the last
    position where depth == 1 (i.e. inside the outer array but between top-level
    objects), trims to there, and re-closes with ']'. Returns ``None`` if the
    string doesn't look like an array start at all.
    """
    s = text.strip()
    if not s.startswith("["):
        return None
    depth = 0
    in_string = False
    escape = False
    last_safe = -1
    for i, ch in enumerate(s):
        if in_string:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_string = False
            continue
        if ch == '"':
            in_string = True
            continue
        if ch in "[{":
            depth += 1
        elif ch in "]}":
            depth -= 1
            if depth == 1 and ch == "}":
                last_safe = i  # closed a top-level object
            elif depth == 0:
                # The array closed cleanly here — try the whole thing
                try:
                    return json.loads(s[: i + 1])
                except json.JSONDecodeError:
                    break
    if last_safe == -1:
        return None
    repaired = s[: last_safe + 1] + "]"
    try:
        return json.loads(repaired)
    except json.JSONDecodeError:
        return None


def _safe_enum(enum_cls, value: Any, default):
    if value is None:
        return default
    try:
        return enum_cls(str(value).upper())
    except (ValueError, KeyError):
        return default


def _clip(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def _stable_id(url: str, headline: str) -> str:
    h = hashlib.sha1((url + "|" + headline).encode("utf-8")).hexdigest()
    return f"live-{h[:12]}"


def reset_caches() -> None:
    """Test helper — wipe the in-process news cache."""
    _news_cache.clear()
