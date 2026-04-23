"""Market-level analytics: index sentiment aggregation and sector ranking."""

from __future__ import annotations

from pydantic import BaseModel

from vamos_core.schemas.common import Sentiment
from vamos_core.schemas.market import MarketSnapshot, SectorPerformance

# Broad-market indices that define overall sentiment.
_BROAD_INDICES = ("NIFTY50", "SENSEX")


class MarketTrend(BaseModel):
    overall_sentiment: Sentiment
    avg_broad_change: float
    advancing_sectors: int
    declining_sectors: int
    top_gaining_sectors: list[tuple[str, float]]
    top_losing_sectors: list[tuple[str, float]]
    index_snapshot: dict[str, float]
    rationale: str


def _classify(change_pct: float) -> Sentiment:
    if change_pct >= 0.5:
        return Sentiment.BULLISH
    if change_pct <= -0.5:
        return Sentiment.BEARISH
    return Sentiment.NEUTRAL


def compute_market_trend(snapshot: MarketSnapshot) -> MarketTrend:
    """Aggregate index + sector data into a single market sentiment."""
    broad = [
        snapshot.indices[s] for s in _BROAD_INDICES if s in snapshot.indices
    ]
    avg_change = (
        sum(i.change_percent for i in broad) / len(broad) if broad else 0.0
    )
    overall = _classify(avg_change)

    sectors = list(snapshot.sector_performance.values())
    advancing = sum(1 for s in sectors if s.change_percent > 0)
    declining = sum(1 for s in sectors if s.change_percent < 0)

    top_gainers = sorted(sectors, key=lambda s: s.change_percent, reverse=True)[:3]
    top_losers = sorted(sectors, key=lambda s: s.change_percent)[:3]

    rationale = (
        f"Broad indices ({', '.join(_BROAD_INDICES)}) averaged "
        f"{avg_change:+.2f}%. "
        f"{advancing} sectors advanced, {declining} declined. "
        f"Sentiment: {overall.value}."
    )

    return MarketTrend(
        overall_sentiment=overall,
        avg_broad_change=round(avg_change, 4),
        advancing_sectors=advancing,
        declining_sectors=declining,
        top_gaining_sectors=[(s.sector, s.change_percent) for s in top_gainers],
        top_losing_sectors=[(s.sector, s.change_percent) for s in top_losers],
        index_snapshot={
            k: round(v.change_percent, 2) for k, v in snapshot.indices.items()
        },
        rationale=rationale,
    )


def rank_sectors(snapshot: MarketSnapshot) -> list[SectorPerformance]:
    """Sectors sorted by absolute change magnitude (biggest movers first)."""
    return sorted(
        snapshot.sector_performance.values(),
        key=lambda s: abs(s.change_percent),
        reverse=True,
    )
