"""Builds the compact, prioritized context sent to the reasoner.

The reasoning quality depends heavily on *what* we hand to the model —
so we pre-filter to the holdings and news that matter for this portfolio.
"""

from __future__ import annotations

from typing import Any

from vamos_core.analytics.market import MarketTrend
from vamos_core.analytics.news import RankedNews
from vamos_core.analytics.portfolio import PortfolioAnalyticsResult
from vamos_core.schemas.market import MarketSnapshot
from vamos_core.schemas.portfolio import Portfolio
from vamos_core.schemas.sector import SectorUniverse


def _portfolio_summary(p: Portfolio, analytics: PortfolioAnalyticsResult) -> dict[str, Any]:
    return {
        "portfolio_id": p.portfolio_id,
        "user_name": p.user_name,
        "type": p.portfolio_type.value,
        "risk_profile": p.risk_profile.value,
        "current_value": analytics.current_value,
        "day_change_pct": analytics.day_summary.day_change_percent,
        "day_change_abs": analytics.day_summary.day_change_absolute,
        "asset_allocation": analytics.asset_type_allocation,
        "sector_allocation": analytics.sector_allocation,
        "concentration_risk": analytics.concentration_risk,
        "concentration_alerts": [
            {"level": a.level, "kind": a.kind, "name": a.name, "weight": a.weight_percent}
            for a in analytics.alerts
        ],
        "top_gainer": analytics.day_summary.top_gainer,
        "top_loser": analytics.day_summary.top_loser,
    }


def _holdings_snapshot(p: Portfolio) -> list[dict[str, Any]]:
    stocks = [
        {
            "kind": "STOCK",
            "symbol": h.symbol,
            "sector": h.sector,
            "weight_pct": h.weight_in_portfolio,
            "day_change_pct": h.day_change_percent,
            "day_change_abs": h.day_change,
            "overall_gain_pct": h.gain_loss_percent,
        }
        for h in p.holdings.stocks
    ]
    mfs = [
        {
            "kind": "MUTUAL_FUND",
            "scheme": m.scheme_code,
            "name": m.scheme_name,
            "category": m.category,
            "weight_pct": m.weight_in_portfolio,
            "day_change_pct": m.day_change_percent,
            "day_change_abs": m.day_change,
        }
        for m in p.holdings.mutual_funds
    ]
    # Sort by weight descending — the reasoner should see big positions first
    return sorted(stocks + mfs, key=lambda x: x["weight_pct"], reverse=True)


def _news_payload(ranked: list[RankedNews]) -> list[dict[str, Any]]:
    return [
        {
            "id": r.article.id,
            "headline": r.article.headline,
            "summary": r.article.summary,
            "sentiment": r.article.sentiment.value,
            "sentiment_score": r.article.sentiment_score,
            "scope": r.article.scope.value,
            "impact_level": r.article.impact_level.value,
            "sectors": r.article.entities.sectors,
            "stocks": r.article.entities.stocks,
            "causal_factors": r.article.causal_factors,
            "relevance_score": r.relevance_score,
            "portfolio_exposure_pct": r.portfolio_exposure_pct,
            "why_relevant": r.reason,
        }
        for r in ranked
    ]


def _market_payload(trend: MarketTrend, snapshot: MarketSnapshot) -> dict[str, Any]:
    return {
        "overall_sentiment": trend.overall_sentiment.value,
        "broad_avg_change_pct": trend.avg_broad_change,
        "advancing_sectors": trend.advancing_sectors,
        "declining_sectors": trend.declining_sectors,
        "index_snapshot": trend.index_snapshot,
        "top_gaining_sectors": trend.top_gaining_sectors,
        "top_losing_sectors": trend.top_losing_sectors,
        "rationale": trend.rationale,
        "sector_performance": {
            name: {
                "change_pct": s.change_percent,
                "sentiment": s.sentiment.value,
                "key_drivers": s.key_drivers,
            }
            for name, s in snapshot.sector_performance.items()
        },
    }


def _sector_context(
    universe: SectorUniverse, portfolio: Portfolio
) -> dict[str, Any]:
    held_sectors = {h.sector for h in portfolio.holdings.stocks}
    return {
        "held_sectors": sorted(held_sectors),
        "rate_sensitive_held": [
            s for s in held_sectors if s in universe.rate_sensitive_sectors
        ],
        "defensive_held": [s for s in held_sectors if s in universe.defensive_sectors],
        "cyclical_held": [s for s in held_sectors if s in universe.cyclical_sectors],
        "macro_correlations": universe.macro_correlations,
    }


def build_context(
    *,
    portfolio: Portfolio,
    analytics: PortfolioAnalyticsResult,
    ranked_news: list[RankedNews],
    market_trend: MarketTrend,
    market_snapshot: MarketSnapshot,
    sector_universe: SectorUniverse,
) -> dict[str, Any]:
    """All inputs the reasoner needs, compacted and prioritized."""
    return {
        "portfolio_summary": _portfolio_summary(portfolio, analytics),
        "holdings_snapshot": _holdings_snapshot(portfolio),
        "ranked_news": _news_payload(ranked_news),
        "market_trend": _market_payload(market_trend, market_snapshot),
        "sector_context": _sector_context(sector_universe, portfolio),
    }
