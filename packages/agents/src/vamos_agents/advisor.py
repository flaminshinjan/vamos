"""Advisor orchestrator: analytics → prioritize → reason → evaluate."""

from __future__ import annotations

import logging
import time

from vamos_core.analytics import (
    compute_market_trend,
    compute_portfolio_analytics,
    rank_news_for_portfolio,
)
from vamos_core.data_loader import DataLoader

from vamos_agents.context import build_context
from vamos_agents.evaluator import Evaluator
from vamos_agents.reasoner import Reasoner, ReasonerError
from vamos_agents.schemas import AdvisorBriefing
from vamos_agents.settings import Settings, get_settings
from vamos_agents.tracing import get_tracer

logger = logging.getLogger(__name__)


class AdvisorAgent:
    def __init__(
        self,
        loader: DataLoader,
        settings: Settings | None = None,
        *,
        reasoner: Reasoner | None = None,
        evaluator: Evaluator | None = None,
    ) -> None:
        self.loader = loader
        self.settings = settings or get_settings()
        self.reasoner = reasoner or Reasoner(self.settings)
        self.evaluator = evaluator or Evaluator(self.settings)
        self.tracer = get_tracer()

    def brief(
        self,
        portfolio_id: str,
        *,
        top_news: int = 8,
        skip_evaluation: bool = False,
    ) -> AdvisorBriefing:
        """Produce a full briefing for the given portfolio."""
        t0 = time.perf_counter()

        portfolio = self.loader.get_portfolio(portfolio_id)
        market_snapshot = self.loader.market_snapshot
        news = self.loader.news
        universe = self.loader.sector_universe

        # 1. Pure analytics (deterministic, cheap, traceable)
        market_trend = compute_market_trend(market_snapshot)
        analytics = compute_portfolio_analytics(portfolio)
        ranked_news = rank_news_for_portfolio(news, portfolio, top_k=top_news)

        # 2. Build compact, prioritized context for the reasoner
        context = build_context(
            portfolio=portfolio,
            analytics=analytics,
            ranked_news=ranked_news,
            market_trend=market_trend,
            market_snapshot=market_snapshot,
            sector_universe=universe,
        )

        with self.tracer.trace(
            "advisor.brief",
            user_id=portfolio.user_id,
            metadata={
                "portfolio_id": portfolio_id,
                "portfolio_type": portfolio.portfolio_type.value,
                "top_news": top_news,
            },
        ) as trace:
            # 3. Reason
            with trace.span("reasoning") as reasoning_span:
                try:
                    briefing_dict, usage = self.reasoner.reason(
                        context, span=reasoning_span
                    )
                except ReasonerError:
                    raise

            # 4. Evaluate
            evaluation = None
            if not skip_evaluation:
                with trace.span("evaluation") as eval_span:
                    evaluation = self.evaluator.evaluate(
                        briefing_dict, context, span=eval_span
                    )

            latency_ms = int((time.perf_counter() - t0) * 1000)
            trace.update(
                metadata={
                    "latency_ms": latency_ms,
                    "eval_score": evaluation.score if evaluation else None,
                }
            )
            trace_id = trace.trace_id

        return AdvisorBriefing(
            portfolio_id=portfolio_id,
            user_name=portfolio.user_name,
            as_of_date=market_snapshot.date,
            headline=briefing_dict.get("headline", ""),
            summary=briefing_dict.get("summary", ""),
            causal_chains=briefing_dict.get("causal_chains", []),
            key_insights=briefing_dict.get("key_insights", []),
            conflicts=briefing_dict.get("conflicts", []),
            recommendations=briefing_dict.get("recommendations", []),
            confidence=float(briefing_dict.get("confidence", 0.5)),
            confidence_rationale=briefing_dict.get("confidence_rationale", ""),
            market_trend=market_trend,
            portfolio_analytics=analytics,
            evaluation=evaluation,
            trace_id=trace_id,
            latency_ms=latency_ms,
            token_usage=usage,
        )
