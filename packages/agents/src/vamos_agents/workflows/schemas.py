"""Pydantic schemas for chat-agent workflow card payloads.

Each workflow finishes by emitting a ``card`` event whose payload conforms
to one of these models. The frontend can rely on the shape per ``kind``.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class NewsRef(BaseModel):
    title: str
    url: str
    source: str
    date: str
    snippet: str = ""


class StockQuote(BaseModel):
    symbol: str
    price: float | None = None
    change_pct: float | None = None
    currency: str | None = None
    title: str | None = None

    @classmethod
    def from_serpapi_finance(cls, symbol: str, payload: dict[str, Any]) -> StockQuote:
        summary = payload.get("summary") or {}
        movement = summary.get("price_movement") or {}
        pct = _to_float(movement.get("percentage"))
        if pct is not None and str(movement.get("movement", "")).lower() == "down":
            pct = -abs(pct)
        elif pct is not None:
            pct = abs(pct)
        return cls(
            symbol=symbol,
            price=_to_float(summary.get("extracted_price")),
            change_pct=pct,
            currency=summary.get("currency"),
            title=summary.get("title"),
        )


def _to_float(v: Any) -> float | None:
    if v in (None, ""):
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


class StockDiagnosis(BaseModel):
    symbol: str
    quote: StockQuote
    headlines: list[NewsRef] = Field(default_factory=list)
    reasoning: str
    summary: str


class HistoricalPoint(BaseModel):
    date: str
    close: float


class MarketForecast(BaseModel):
    headline: str
    current_summary: str
    historical: list[HistoricalPoint] = Field(default_factory=list)
    momentum_pct_5d: float | None = None
    momentum_pct_20d: float | None = None
    outlook: str
    headlines: list[NewsRef] = Field(default_factory=list)


class SectorPerformanceCard(BaseModel):
    sector: str
    index_quote: StockQuote | None = None
    headlines: list[NewsRef] = Field(default_factory=list)
    summary: str


class TrendMover(BaseModel):
    symbol: str
    change_pct_5d: float | None = None
    change_pct_20d: float | None = None
    last_close: float | None = None


class TrendScan(BaseModel):
    up_movers: list[TrendMover]
    down_movers: list[TrendMover]
    summary: str


class HoldingPerformance(BaseModel):
    symbol: str
    sector: str
    weight_pct: float
    day_change_pct: float
    day_change_abs: float
    overall_gain_pct: float
    current_value: float


class HoldingsPerformanceCard(BaseModel):
    holdings: list[HoldingPerformance]
    top_gainer: dict[str, Any] | None = None
    top_loser: dict[str, Any] | None = None
    day_change_pct: float
