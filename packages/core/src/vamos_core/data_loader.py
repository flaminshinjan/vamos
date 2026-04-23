"""Load and validate the mock data files into typed domain models.

The loader caches parsed data — instantiating once per process is enough.
Handles missing files / malformed records gracefully with explicit errors.
"""

from __future__ import annotations

import json
from functools import cached_property
from pathlib import Path

from vamos_core.schemas.market import Index, MarketSnapshot, SectorPerformance, Stock
from vamos_core.schemas.news import NewsArticle
from vamos_core.schemas.portfolio import Portfolio
from vamos_core.schemas.sector import SectorInfo, SectorUniverse


class DataLoader:
    def __init__(self, data_dir: str | Path):
        self.data_dir = Path(data_dir)
        if not self.data_dir.is_dir():
            raise FileNotFoundError(f"Data directory not found: {self.data_dir}")

    def _read_json(self, filename: str) -> dict:
        path = self.data_dir / filename
        if not path.exists():
            raise FileNotFoundError(f"Required data file missing: {path}")
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)

    @cached_property
    def market_snapshot(self) -> MarketSnapshot:
        raw = self._read_json("market_data.json")
        indices = {
            key: Index.model_validate({**value, "symbol": key})
            for key, value in raw["indices"].items()
        }
        sectors = {
            key: SectorPerformance.model_validate({**value, "sector": key})
            for key, value in raw["sector_performance"].items()
        }
        stocks = {
            key: Stock.model_validate({**value, "symbol": key})
            for key, value in raw["stocks"].items()
        }
        return MarketSnapshot(
            date=raw["metadata"]["date"],
            indices=indices,
            sector_performance=sectors,
            stocks=stocks,
        )

    @cached_property
    def news(self) -> list[NewsArticle]:
        raw = self._read_json("news_data.json")
        return [NewsArticle.model_validate(item) for item in raw["news"]]

    @cached_property
    def portfolios(self) -> dict[str, Portfolio]:
        raw = self._read_json("portfolios.json")
        return {
            pid: Portfolio.model_validate({**pdata, "portfolio_id": pid})
            for pid, pdata in raw["portfolios"].items()
        }

    @cached_property
    def sector_universe(self) -> SectorUniverse:
        raw = self._read_json("sector_mapping.json")
        sectors = {
            key: SectorInfo.model_validate({**value, "sector": key})
            for key, value in raw["sectors"].items()
        }
        return SectorUniverse(
            sectors=sectors,
            macro_correlations=raw.get("macro_correlations", {}),
            defensive_sectors=raw.get("defensive_sectors", []),
            cyclical_sectors=raw.get("cyclical_sectors", []),
            rate_sensitive_sectors=raw.get("rate_sensitive_sectors", []),
            export_oriented_sectors=raw.get("export_oriented_sectors", []),
        )

    # Lookups --------------------------------------------------------------
    def get_portfolio(self, portfolio_id: str) -> Portfolio:
        p = self.portfolios.get(portfolio_id)
        if p is None:
            raise KeyError(f"Unknown portfolio: {portfolio_id}")
        return p

    def list_portfolio_ids(self) -> list[str]:
        return list(self.portfolios.keys())

    def news_for_sector(self, sector: str) -> list[NewsArticle]:
        return [n for n in self.news if n.mentions_sector(sector)]

    def news_for_stock(self, symbol: str) -> list[NewsArticle]:
        return [n for n in self.news if n.mentions_stock(symbol)]
