"""Portfolio endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from vamos_core import DataLoader
from vamos_core.analytics import (
    compute_portfolio_analytics,
    rank_news_for_portfolio,
)
from vamos_core.analytics.portfolio import PortfolioAnalyticsResult

from vamos_api.core.deps import get_data_loader

router = APIRouter(prefix="/portfolios", tags=["portfolios"])


@router.get("")
def list_portfolios(loader: DataLoader = Depends(get_data_loader)) -> list[dict]:
    """Lightweight list — just identity + summary stats."""
    out = []
    for pid in loader.list_portfolio_ids():
        p = loader.get_portfolio(pid)
        out.append(
            {
                "portfolio_id": pid,
                "user_name": p.user_name,
                "portfolio_type": p.portfolio_type.value,
                "risk_profile": p.risk_profile.value,
                "description": p.description,
                "current_value": p.current_value,
                "overall_gain_loss_percent": p.overall_gain_loss_percent,
            }
        )
    return out


@router.get("/{portfolio_id}")
def get_portfolio(
    portfolio_id: str, loader: DataLoader = Depends(get_data_loader)
) -> dict:
    try:
        p = loader.get_portfolio(portfolio_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Unknown portfolio: {portfolio_id}")
    return p.model_dump()


@router.get("/{portfolio_id}/analytics", response_model=PortfolioAnalyticsResult)
def portfolio_analytics(
    portfolio_id: str, loader: DataLoader = Depends(get_data_loader)
) -> PortfolioAnalyticsResult:
    try:
        p = loader.get_portfolio(portfolio_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Unknown portfolio: {portfolio_id}")
    return compute_portfolio_analytics(p)


@router.get("/{portfolio_id}/relevant-news")
def portfolio_relevant_news(
    portfolio_id: str,
    top_k: int = 10,
    loader: DataLoader = Depends(get_data_loader),
) -> list[dict]:
    try:
        p = loader.get_portfolio(portfolio_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Unknown portfolio: {portfolio_id}")
    ranked = rank_news_for_portfolio(loader.news, p, top_k=top_k)
    return [
        {
            "relevance_score": r.relevance_score,
            "matched_sectors": r.matched_sectors,
            "matched_stocks": r.matched_stocks,
            "portfolio_exposure_pct": r.portfolio_exposure_pct,
            "why_relevant": r.reason,
            "article": r.article.model_dump(),
        }
        for r in ranked
    ]
