"""Portfolio-level text-only workflows.

Three local-data-only tools that answer the most common conversational
intents without standing up the full briefing pipeline:

``explain_portfolio_move``    — short causal read of today's move
``compare_portfolio_to_market``— "are you matching the market" comparison
``show_my_mutual_funds``       — MF-only performance card + summary

All three lean on local data + Haiku for prose. No SerpApi, no streaming
JSON, no evaluator. Output is a ``note`` text card (or ``mutual_funds``
card for the MF tool), so the frontend renders a plain text bubble — no
heavyweight chrome.
"""

from __future__ import annotations

import logging
import time
from typing import Iterator

from vamos_core.analytics.market import MarketTrend
from vamos_core.analytics.news import RankedNews
from vamos_core.analytics.portfolio import PortfolioAnalyticsResult
from vamos_core.schemas.portfolio import Portfolio

from vamos_agents.workflows._deps import WorkflowDeps
from vamos_agents.workflows._events import card, tool_done, tool_start

logger = logging.getLogger(__name__)


# ── Tool 1 · explain_portfolio_move ───────────────────────────────────


def explain_portfolio_move(
    portfolio: Portfolio,
    *,
    trend: MarketTrend,
    analytics: PortfolioAnalyticsResult,
    ranked_news: list[RankedNews],
    deps: WorkflowDeps,
) -> Iterator[dict]:
    """Short text-only read of today's portfolio move (no full briefing)."""
    ts = time.perf_counter()
    yield tool_start(
        "summarize_portfolio_move",
        "Reading today's drivers",
        f"{len(portfolio.holdings.stocks)} stocks · {len(ranked_news)} news",
    )
    text = _haiku_explain_move(deps, portfolio, trend, analytics, ranked_news)
    yield tool_done("summarize_portfolio_move", ts)
    yield card("note", {"text": text, "tone": _tone_for_change(analytics.day_summary.day_change_percent)})


def _haiku_explain_move(
    deps: WorkflowDeps,
    portfolio: Portfolio,
    trend: MarketTrend,
    analytics: PortfolioAnalyticsResult,
    ranked_news: list[RankedNews],
) -> str:
    stocks = portfolio.holdings.stocks
    if not stocks:
        return "You don't have any direct stock holdings — the portfolio's move today is driven entirely by your mutual funds."

    sorted_by_impact = sorted(
        stocks, key=lambda h: abs(h.day_change * h.weight_in_portfolio / 100), reverse=True
    )[:5]
    movers_block = "\n".join(
        f"- {h.symbol} ({h.sector}, {h.weight_in_portfolio:.1f}% of book): "
        f"{h.day_change_percent:+.2f}%"
        for h in sorted_by_impact
    )
    news_block = (
        "\n".join(
            f"- [{r.article.sentiment}] {r.article.headline} "
            f"(touches {', '.join(r.matched_sectors or r.matched_stocks) or 'market-wide'})"
            for r in ranked_news[:5]
        )
        or "- (no portfolio-relevant news today)"
    )
    fallback = _fallback_move_summary(portfolio, analytics, sorted_by_impact)

    if not deps.settings.anthropic_api_key:
        return fallback

    user = (
        f"User: {portfolio.user_name.split()[0]}\n"
        f"Portfolio day change: {analytics.day_summary.day_change_percent:+.2f}% "
        f"({analytics.day_summary.day_change_absolute:+,.0f} INR)\n"
        f"Market: NIFTY/SENSEX avg {trend.avg_broad_change:+.2f}% "
        f"({trend.overall_sentiment.value})\n\n"
        f"Top impact-weighted movers in this portfolio:\n{movers_block}\n\n"
        f"Portfolio-relevant news today:\n{news_block}\n\n"
        "Write 3–4 sentences answering 'why is my portfolio moving today'. Be "
        "specific about which holdings drove the move and which news (if any) "
        "explains it. If the news is thin or doesn't connect, say the move "
        "looks technical / macro-driven and don't invent a catalyst. Plain "
        "text only — no markdown, no bullets, no disclaimers."
    )
    try:
        resp = deps.anthropic.messages.create(
            model=deps.settings.eval_model,
            max_tokens=300,
            system=(
                "You are a sober equity analyst. Answer in plain prose. "
                "Never invent news or catalysts. If the data doesn't support a "
                "specific cause, say the move looks technical or macro-driven."
            ),
            messages=[{"role": "user", "content": user}],
        )
        text = _join_text(resp).strip()
        return text or fallback
    except Exception as e:
        logger.warning("explain_portfolio_move haiku failed: %s", e)
        return fallback


def _fallback_move_summary(
    portfolio: Portfolio,
    analytics: PortfolioAnalyticsResult,
    movers: list,
) -> str:
    pct = analytics.day_summary.day_change_percent
    direction = "down" if pct < 0 else "up"
    if not movers:
        return f"Your portfolio is {direction} {abs(pct):.2f}% today."
    leader = movers[0]
    return (
        f"Your portfolio is {direction} {abs(pct):.2f}% today, "
        f"largely driven by {leader.symbol} ({leader.day_change_percent:+.2f}%, "
        f"{leader.weight_in_portfolio:.1f}% of book) in {leader.sector}."
    )


# ── Tool 2 · compare_portfolio_to_market ──────────────────────────────


def compare_portfolio_to_market(
    portfolio: Portfolio,
    *,
    trend: MarketTrend,
    analytics: PortfolioAnalyticsResult,
    ranked_news: list[RankedNews],
    deps: WorkflowDeps,
) -> Iterator[dict]:
    """Explain the gap between portfolio performance and the broad market."""
    ts = time.perf_counter()
    yield tool_start(
        "compare_to_market",
        "Comparing your book to NIFTY/SENSEX",
        f"portfolio {analytics.day_summary.day_change_percent:+.2f}% vs market {trend.avg_broad_change:+.2f}%",
    )
    text = _haiku_compare(deps, portfolio, trend, analytics, ranked_news)
    yield tool_done("compare_to_market", ts)
    yield card("note", {"text": text, "tone": "neutral"})


def _haiku_compare(
    deps: WorkflowDeps,
    portfolio: Portfolio,
    trend: MarketTrend,
    analytics: PortfolioAnalyticsResult,
    ranked_news: list[RankedNews],
) -> str:
    pct_p = analytics.day_summary.day_change_percent
    pct_m = trend.avg_broad_change
    gap = pct_p - pct_m

    sectors = sorted(
        analytics.sector_allocation.items(), key=lambda kv: kv[1], reverse=True
    )
    sector_block = "\n".join(f"- {k}: {v:.1f}%" for k, v in sectors[:5]) or "(no sector data)"

    holdings = portfolio.holdings.stocks
    sorted_movers = sorted(holdings, key=lambda h: h.day_change_percent, reverse=True)
    top_block = "\n".join(
        f"- {h.symbol} ({h.sector}): {h.day_change_percent:+.2f}%"
        for h in sorted_movers[:3] + sorted_movers[-3:]
    ) or "(no holdings)"

    fallback = _fallback_compare(pct_p, pct_m, gap, trend)

    if not deps.settings.anthropic_api_key:
        return fallback

    user = (
        f"Portfolio day change: {pct_p:+.2f}%\n"
        f"Market (NIFTY/SENSEX avg): {pct_m:+.2f}%\n"
        f"Gap: {gap:+.2f}%\n"
        f"Advancing sectors: {trend.advancing_sectors} / Declining: {trend.declining_sectors}\n\n"
        f"Portfolio sector allocation (top 5):\n{sector_block}\n\n"
        f"Best & worst holdings today:\n{top_block}\n\n"
        "Write 3–4 sentences answering 'why isn't my portfolio matching the "
        "market today'. Identify which sectors / holdings explain the gap "
        "(over- or under-exposure to today's leaders / laggards). If the gap "
        "is small (<0.3%), say it's roughly tracking. Plain text — no "
        "bullets, no markdown."
    )
    try:
        resp = deps.anthropic.messages.create(
            model=deps.settings.eval_model,
            max_tokens=300,
            system=(
                "You are a sober equity analyst. Be specific about sector / "
                "stock exposure when explaining tracking gaps. Never invent."
            ),
            messages=[{"role": "user", "content": user}],
        )
        text = _join_text(resp).strip()
        return text or fallback
    except Exception as e:
        logger.warning("compare_portfolio_to_market haiku failed: %s", e)
        return fallback


def _fallback_compare(
    pct_p: float, pct_m: float, gap: float, trend: MarketTrend
) -> str:
    if abs(gap) < 0.3:
        return (
            f"Your portfolio is roughly tracking the market today — "
            f"you're {pct_p:+.2f}% vs market {pct_m:+.2f}% (gap {gap:+.2f}%)."
        )
    direction = "ahead of" if gap > 0 else "behind"
    return (
        f"Your portfolio is {abs(gap):.2f}% {direction} the market today "
        f"({pct_p:+.2f}% vs {pct_m:+.2f}%). "
        f"{trend.advancing_sectors} sectors advanced, {trend.declining_sectors} declined — "
        f"the gap reflects which side your sector mix sits on."
    )


# ── Tool 3 · show_my_mutual_funds ─────────────────────────────────────


def show_my_mutual_funds(portfolio: Portfolio) -> Iterator[dict]:
    """List MF holdings with returns + day change. Local data only."""
    mfs = portfolio.holdings.mutual_funds
    if not mfs:
        yield card(
            "note",
            {
                "text": (
                    "You don't have any mutual funds in this portfolio — "
                    "it's all direct stocks."
                ),
                "tone": "neutral",
            },
        )
        return

    items = []
    for m in sorted(mfs, key=lambda x: x.weight_in_portfolio, reverse=True):
        items.append(
            {
                "scheme_code": m.scheme_code,
                "scheme_name": m.scheme_name,
                "category": m.category,
                "amc": m.amc,
                "current_value": m.current_value,
                "weight_pct": m.weight_in_portfolio,
                "day_change_pct": m.day_change_percent,
                "day_change_abs": m.day_change,
                "overall_gain_pct": m.gain_loss_percent,
            }
        )

    avg_day = sum(m.day_change_percent * m.weight_in_portfolio for m in mfs) / max(
        sum(m.weight_in_portfolio for m in mfs), 1e-9
    )
    summary = (
        f"You hold {len(mfs)} fund{'s' if len(mfs) > 1 else ''}. "
        f"Weighted day move: {avg_day:+.2f}%. "
        "MFs typically move slower than direct stocks because their NAVs only "
        "settle once a day and they're inherently diversified across many holdings."
    )

    yield card(
        "mutual_funds",
        {
            "summary": summary,
            "funds": items,
            "weighted_day_change_pct": round(avg_day, 2),
        },
    )


# ── Helpers ───────────────────────────────────────────────────────────


def _tone_for_change(pct: float) -> str:
    if pct > 0.3:
        return "positive"
    if pct < -0.3:
        return "negative"
    return "neutral"


def _join_text(resp) -> str:
    return "".join(b.text for b in resp.content if getattr(b, "type", None) == "text")
