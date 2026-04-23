"""Market intelligence endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from vamos_core import DataLoader
from vamos_core.analytics import compute_market_trend, rank_sectors
from vamos_core.analytics.market import MarketTrend

from vamos_api.core.deps import get_data_loader

router = APIRouter(prefix="/market", tags=["market"])


@router.get("/snapshot")
def market_snapshot(loader: DataLoader = Depends(get_data_loader)) -> dict:
    """Raw market snapshot — indices, sectors, stocks."""
    snap = loader.market_snapshot
    return {
        "date": snap.date,
        "indices": {k: v.model_dump(by_alias=True) for k, v in snap.indices.items()},
        "sector_performance": {
            k: v.model_dump() for k, v in snap.sector_performance.items()
        },
        "stock_count": len(snap.stocks),
    }


@router.get("/trend", response_model=MarketTrend)
def market_trend(loader: DataLoader = Depends(get_data_loader)) -> MarketTrend:
    """Derived overall sentiment + sector rankings."""
    return compute_market_trend(loader.market_snapshot)


@router.get("/sectors")
def sector_ranking(loader: DataLoader = Depends(get_data_loader)) -> list[dict]:
    """Sectors ranked by absolute move size."""
    return [s.model_dump() for s in rank_sectors(loader.market_snapshot)]


@router.get("/stocks/{symbol}")
def stock_detail(symbol: str, loader: DataLoader = Depends(get_data_loader)) -> dict:
    stock = loader.market_snapshot.get_stock(symbol.upper())
    if stock is None:
        raise HTTPException(status_code=404, detail=f"Unknown stock: {symbol}")
    news = loader.news_for_stock(symbol.upper())
    return {
        "stock": stock.model_dump(by_alias=True),
        "related_news": [n.model_dump() for n in news],
    }
