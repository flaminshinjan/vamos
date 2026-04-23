"""Tests cross-check our recomputed analytics against the pre-baked
`analytics` block in portfolios.json (the ground truth from the mock data).
"""

from vamos_core.analytics import (
    compute_market_trend,
    compute_portfolio_analytics,
    rank_news_for_portfolio,
)
from vamos_core.schemas.common import Sentiment


def test_market_trend_is_bearish(loader):
    trend = compute_market_trend(loader.market_snapshot)
    assert trend.overall_sentiment == Sentiment.BEARISH
    assert trend.avg_broad_change < 0


def test_portfolio_day_pnl_matches_mock(loader):
    """Our computed day change % must match the mock ground truth."""
    for pid in loader.list_portfolio_ids():
        p = loader.get_portfolio(pid)
        computed = compute_portfolio_analytics(p)
        mock = p.analytics
        assert abs(
            computed.day_summary.day_change_percent
            - mock.day_summary.day_change_percent
        ) < 0.05, f"{pid}: mismatch"


def test_concentration_detection(loader):
    p002 = loader.get_portfolio("PORTFOLIO_002")  # banking-heavy
    a = compute_portfolio_analytics(p002)
    assert a.concentration_risk is True
    assert any(alert.kind == "SECTOR" and alert.name == "BANKING" for alert in a.alerts)
    assert any(alert.kind == "STOCK" and alert.name == "HDFCBANK" for alert in a.alerts)


def test_diversified_no_concentration(loader):
    p001 = loader.get_portfolio("PORTFOLIO_001")
    a = compute_portfolio_analytics(p001)
    assert a.concentration_risk is False
    assert a.alerts == []


def test_news_ranking_prioritizes_held_stocks(loader):
    p002 = loader.get_portfolio("PORTFOLIO_002")  # banking-heavy
    ranked = rank_news_for_portfolio(loader.news, p002, top_k=5)
    # The HDFC Bank news must appear in top-5 since it's the biggest holding
    assert any("HDFC" in r.article.headline for r in ranked[:5])
    # Results sorted by relevance
    scores = [r.relevance_score for r in ranked]
    assert scores == sorted(scores, reverse=True)
