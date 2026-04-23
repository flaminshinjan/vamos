"""Pure analytical functions — no I/O, no LLM, deterministic."""

from vamos_core.analytics.market import (
    MarketTrend,
    compute_market_trend,
    rank_sectors,
)
from vamos_core.analytics.news import RankedNews, rank_news_for_portfolio
from vamos_core.analytics.portfolio import (
    PortfolioAnalyticsResult,
    compute_portfolio_analytics,
)

__all__ = [
    "MarketTrend",
    "PortfolioAnalyticsResult",
    "RankedNews",
    "compute_market_trend",
    "compute_portfolio_analytics",
    "rank_news_for_portfolio",
    "rank_sectors",
]
