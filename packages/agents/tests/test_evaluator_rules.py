"""Rule-check tests for the evaluator — these run without any LLM."""

from pathlib import Path

import pytest

from vamos_agents.context import build_context
from vamos_agents.evaluator import Evaluator
from vamos_agents.settings import Settings
from vamos_core import DataLoader
from vamos_core.analytics import (
    compute_market_trend,
    compute_portfolio_analytics,
    rank_news_for_portfolio,
)

REPO_ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = REPO_ROOT / "data"


@pytest.fixture(scope="module")
def context():
    loader = DataLoader(DATA_DIR)
    p = loader.get_portfolio("PORTFOLIO_002")
    analytics = compute_portfolio_analytics(p)
    trend = compute_market_trend(loader.market_snapshot)
    ranked = rank_news_for_portfolio(loader.news, p, top_k=6)
    return build_context(
        portfolio=p,
        analytics=analytics,
        ranked_news=ranked,
        market_trend=trend,
        market_snapshot=loader.market_snapshot,
        sector_universe=loader.sector_universe,
    )


def _make_evaluator() -> Evaluator:
    # No API key → LLM judge disabled → pure rule-based
    return Evaluator(
        Settings(
            anthropic_api_key=None,
            reasoning_model="",
            eval_model="",
            langfuse_public_key=None,
            langfuse_secret_key=None,
            langfuse_host="",
            data_dir=DATA_DIR,
            max_output_tokens=0,
            request_timeout_s=1.0,
            serpapi_key=None,
            provider_cache_ttl_s=0,
        )
    )


def test_rules_flag_missing_concentration_warning(context):
    """Portfolio 2 has concentration risk — if the brief omits it, penalize."""
    evaluator = _make_evaluator()
    bad_brief = {
        "headline": "Portfolio down",
        "summary": "Your portfolio fell.",
        "causal_chains": [
            {
                "trigger": "Banking sell-off",
                "sector": "BANKING",
                "sector_impact_pct": -2.45,
                "stocks": ["HDFCBANK"],
                "portfolio_impact_pct": -2.7,
                "narrative": "Banks fell.",
            }
        ],
        "key_insights": [
            {"title": "Market down", "detail": "NIFTY -1%", "severity": "INFO"}
        ],
        "confidence": 0.8,
        "confidence_rationale": "ok",
    }
    result = evaluator.evaluate(bad_brief, context)
    assert result.method == "rules_only"
    assert any("concent" in m.lower() for m in result.missing_elements)


def test_rules_penalize_cited_stocks_not_in_portfolio(context):
    evaluator = _make_evaluator()
    bad_brief = {
        "headline": "x",
        "summary": "x",
        "causal_chains": [
            {
                "trigger": "t",
                "sector": "BANKING",
                "sector_impact_pct": -2.0,
                "stocks": ["RELIANCE"],  # not in PORTFOLIO_002
                "portfolio_impact_pct": -2.0,
                "narrative": "n",
            }
        ],
        "key_insights": [
            {"title": "Concentration", "detail": "Banking 71%", "severity": "CRITICAL"}
        ],
        "confidence": 0.5,
        "confidence_rationale": "ok",
    }
    result = evaluator.evaluate(bad_brief, context)
    assert any("not in portfolio" in m.lower() for m in result.missing_elements)


def test_rules_accept_good_brief(context):
    evaluator = _make_evaluator()
    good_brief = {
        "headline": "Banking concentration bit you today",
        "summary": (
            "RBI's hawkish stance hit banking hard, and your 72% banking "
            "exposure amplified the damage."
        ),
        "causal_chains": [
            {
                "trigger": "RBI hawkish signal on repo",
                "sector": "BANKING",
                "sector_impact_pct": -2.45,
                "stocks": ["HDFCBANK", "ICICIBANK", "SBIN"],
                "portfolio_impact_pct": -2.7,
                "narrative": "RBI → banking → your top 3 holdings → -2.73%.",
            }
        ],
        "key_insights": [
            {
                "title": "Concentration risk",
                "detail": "71.9% in banking",
                "severity": "CRITICAL",
            }
        ],
        "confidence": 0.85,
        "confidence_rationale": "Clear signal, known causality.",
    }
    result = evaluator.evaluate(good_brief, context)
    assert result.score >= 0.8
    assert result.method == "rules_only"
