"""Output schemas for the agent — these are the contract with the API."""

from __future__ import annotations

from pydantic import BaseModel, Field

from vamos_core.analytics.market import MarketTrend
from vamos_core.analytics.portfolio import PortfolioAnalyticsResult


class CausalChain(BaseModel):
    """News → Sector → Stock → Portfolio linkage."""

    trigger: str  # e.g. "RBI held repo rate and signalled hawkish stance"
    sector: str  # e.g. "BANKING"
    sector_impact_pct: float  # e.g. -2.45
    stocks: list[str]  # affected holdings, e.g. ["HDFCBANK", "ICICIBANK"]
    portfolio_impact_pct: float  # net contribution to portfolio move
    narrative: str  # one-line plain-English version


class KeyInsight(BaseModel):
    title: str
    detail: str
    severity: str = Field(description="INFO | WARN | CRITICAL")


class ConflictSignal(BaseModel):
    """When news and price action disagree."""

    stock_or_sector: str
    news_signal: str
    price_signal: str
    explanation: str


class EvaluationResult(BaseModel):
    score: float = Field(ge=0.0, le=1.0)
    grounded: bool  # claims trace back to input data
    causal_depth: str  # "SHALLOW" | "MODERATE" | "DEEP"
    missing_elements: list[str]
    rationale: str
    method: str  # "llm_judge" | "rules_only" | "hybrid"


class AdvisorBriefing(BaseModel):
    """Top-level output shown to the user."""

    portfolio_id: str
    user_name: str
    as_of_date: str
    headline: str  # one-sentence summary
    summary: str  # 2–4 sentence explanation
    causal_chains: list[CausalChain]
    key_insights: list[KeyInsight]
    conflicts: list[ConflictSignal] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)
    confidence: float = Field(ge=0.0, le=1.0)
    confidence_rationale: str

    # Analytical snapshot attached for traceability
    market_trend: MarketTrend
    portfolio_analytics: PortfolioAnalyticsResult

    # Observability
    evaluation: EvaluationResult | None = None
    trace_id: str | None = None
    latency_ms: int | None = None
    token_usage: dict[str, int] | None = None
