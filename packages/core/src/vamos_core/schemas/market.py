from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from vamos_core.schemas.common import Sentiment


class Index(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    symbol: str
    name: str
    current_value: float
    previous_close: float
    change_percent: float
    change_absolute: float
    day_high: float | None = None
    day_low: float | None = None
    week_52_high: float | None = Field(default=None, alias="52_week_high")
    week_52_low: float | None = Field(default=None, alias="52_week_low")
    sentiment: Sentiment


class SectorPerformance(BaseModel):
    model_config = ConfigDict(extra="ignore")

    sector: str
    change_percent: float
    sentiment: Sentiment
    key_drivers: list[str] = Field(default_factory=list)
    top_gainers: list[str] = Field(default_factory=list)
    top_losers: list[str] = Field(default_factory=list)


class Stock(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    symbol: str
    name: str
    sector: str
    sub_sector: str | None = None
    current_price: float
    previous_close: float
    change_percent: float
    change_absolute: float
    volume: int | None = None
    avg_volume_20d: int | None = None
    market_cap_cr: float | None = None
    pe_ratio: float | None = None
    week_52_high: float | None = Field(default=None, alias="52_week_high")
    week_52_low: float | None = Field(default=None, alias="52_week_low")
    beta: float | None = None


class MarketSnapshot(BaseModel):
    """All market intelligence at a point in time."""

    date: str
    indices: dict[str, Index]
    sector_performance: dict[str, SectorPerformance]
    stocks: dict[str, Stock]

    def get_stock(self, symbol: str) -> Stock | None:
        return self.stocks.get(symbol)

    def get_sector(self, sector: str) -> SectorPerformance | None:
        return self.sector_performance.get(sector)
