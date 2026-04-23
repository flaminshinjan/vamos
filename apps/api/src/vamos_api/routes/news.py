"""News endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from vamos_core import DataLoader

from vamos_api.core.deps import get_data_loader

router = APIRouter(prefix="/news", tags=["news"])


@router.get("")
def list_news(
    scope: str | None = Query(None, description="MARKET_WIDE, SECTOR_SPECIFIC, STOCK_SPECIFIC"),
    impact: str | None = Query(None, description="HIGH, MEDIUM, LOW"),
    loader: DataLoader = Depends(get_data_loader),
) -> list[dict]:
    items = loader.news
    if scope:
        items = [n for n in items if n.scope.value == scope.upper()]
    if impact:
        items = [n for n in items if n.impact_level.value == impact.upper()]
    return [n.model_dump() for n in items]


@router.get("/sectors/{sector}")
def news_for_sector(
    sector: str, loader: DataLoader = Depends(get_data_loader)
) -> list[dict]:
    return [n.model_dump() for n in loader.news_for_sector(sector.upper())]


@router.get("/stocks/{symbol}")
def news_for_stock(
    symbol: str, loader: DataLoader = Depends(get_data_loader)
) -> list[dict]:
    return [n.model_dump() for n in loader.news_for_stock(symbol.upper())]
