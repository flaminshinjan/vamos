"""News relevance ranking for a specific portfolio.

This is the prioritization engine: surface news that *actually matters* to
the user's holdings, so the reasoning layer doesn't drown in noise.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from vamos_core.schemas.common import ImpactLevel, NewsScope
from vamos_core.schemas.news import NewsArticle
from vamos_core.schemas.portfolio import Portfolio

# Scoring weights (tuned, not learned — simple heuristic)
_IMPACT_WEIGHT = {ImpactLevel.HIGH: 1.0, ImpactLevel.MEDIUM: 0.6, ImpactLevel.LOW: 0.3}
_SCOPE_BASE = {
    NewsScope.MARKET_WIDE: 0.4,
    NewsScope.SECTOR_SPECIFIC: 0.7,
    NewsScope.STOCK_SPECIFIC: 1.0,
}


class RankedNews(BaseModel):
    article: NewsArticle
    relevance_score: float = Field(ge=0.0)
    matched_sectors: list[str] = Field(default_factory=list)
    matched_stocks: list[str] = Field(default_factory=list)
    portfolio_exposure_pct: float = 0.0  # % of portfolio that matches
    reason: str


def _portfolio_sector_weights(portfolio: Portfolio) -> dict[str, float]:
    """Map each sector → % weight in this portfolio (stocks only)."""
    weights: dict[str, float] = {}
    for h in portfolio.holdings.stocks:
        weights[h.sector] = weights.get(h.sector, 0.0) + h.weight_in_portfolio
    return weights


def _portfolio_stock_weights(portfolio: Portfolio) -> dict[str, float]:
    return {h.symbol: h.weight_in_portfolio for h in portfolio.holdings.stocks}


def rank_news_for_portfolio(
    articles: list[NewsArticle],
    portfolio: Portfolio,
    top_k: int | None = 10,
) -> list[RankedNews]:
    """Return news ordered by relevance to this portfolio."""
    sector_weights = _portfolio_sector_weights(portfolio)
    stock_weights = _portfolio_stock_weights(portfolio)

    ranked: list[RankedNews] = []
    for article in articles:
        matched_sectors = [s for s in article.entities.sectors if s in sector_weights]
        matched_stocks = [s for s in article.entities.stocks if s in stock_weights]

        # Portfolio exposure (what % of portfolio this article touches)
        exposure = sum(stock_weights.get(s, 0.0) for s in matched_stocks)
        # Plus sector exposure minus double-counting (approx; stocks within
        # matched sectors already count). We take the max for conservatism.
        sector_exposure = sum(sector_weights.get(s, 0.0) for s in matched_sectors)
        exposure = max(exposure, sector_exposure)

        # Score: scope × impact × (1 + exposure/100)
        base = _SCOPE_BASE[article.scope] * _IMPACT_WEIGHT[article.impact_level]
        exposure_multiplier = 1.0 + exposure / 100.0
        score = base * exposure_multiplier

        # Market-wide news always has some relevance, even without matches
        if article.scope == NewsScope.MARKET_WIDE:
            score = max(score, _SCOPE_BASE[NewsScope.MARKET_WIDE] * _IMPACT_WEIGHT[article.impact_level])

        # Skip articles with zero relevance (no match + not market-wide)
        if not matched_sectors and not matched_stocks and article.scope != NewsScope.MARKET_WIDE:
            continue

        reason_parts = []
        if matched_stocks:
            reason_parts.append(f"mentions held stocks {matched_stocks}")
        if matched_sectors:
            reason_parts.append(
                f"affects sectors {matched_sectors} "
                f"({sector_exposure:.1f}% of portfolio)"
            )
        if article.scope == NewsScope.MARKET_WIDE and not reason_parts:
            reason_parts.append("market-wide news affects all holdings")

        ranked.append(
            RankedNews(
                article=article,
                relevance_score=round(score, 3),
                matched_sectors=matched_sectors,
                matched_stocks=matched_stocks,
                portfolio_exposure_pct=round(exposure, 2),
                reason="; ".join(reason_parts),
            )
        )

    ranked.sort(key=lambda r: r.relevance_score, reverse=True)
    if top_k is not None:
        ranked = ranked[:top_k]
    return ranked
