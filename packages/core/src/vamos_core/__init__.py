"""Core domain models, data loading, and analytics.

Public API:
- DataLoader: loads + validates mock datasets
- schemas: Pydantic models for Market, News, Portfolio
- analytics: pure functions for trends, P&L, risk
"""

from vamos_core.data_loader import DataLoader
from vamos_core.schemas.market import Index, MarketSnapshot, SectorPerformance, Stock
from vamos_core.schemas.news import NewsArticle
from vamos_core.schemas.portfolio import MutualFundHolding, Portfolio, StockHolding

__all__ = [
    "DataLoader",
    "Index",
    "MarketSnapshot",
    "MutualFundHolding",
    "NewsArticle",
    "Portfolio",
    "SectorPerformance",
    "Stock",
    "StockHolding",
]
