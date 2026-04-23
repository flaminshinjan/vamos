"""Advisor orchestrator: analytics → prioritize → reason → evaluate."""

from __future__ import annotations

import logging
import time
from typing import Any, Iterator

from vamos_core.analytics import (
    compute_market_trend,
    compute_portfolio_analytics,
    rank_news_for_portfolio,
)
from vamos_core.data_loader import DataLoader

from vamos_agents.context import build_context
from vamos_agents.evaluator import Evaluator
from vamos_agents.reasoner import COMPLETE, DELTA, STREAM_START, Reasoner, ReasonerError
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

    # ------------------------------------------------------------------
    # Streaming
    # ------------------------------------------------------------------

    def brief_stream(
        self,
        portfolio_id: str,
        *,
        top_news: int = 8,
        skip_evaluation: bool = False,
    ) -> Iterator[dict[str, Any]]:
        """Stream the briefing pipeline as Server-Sent-Events-friendly dicts.

        Each pipeline stage is wrapped in a paired tool_call event so the UI
        can render an agent-style reasoning trace ("Ingesting market data" →
        "Classifying news" → …) in real time.

        Event sequence:
            tool_call(start)  ingest_market_data
            tool_call(done)   ingest_market_data
            tool_call(start)  classify_news
            tool_call(done)   classify_news
            tool_call(start)  compute_portfolio_exposure
            tool_call(done)   compute_portfolio_exposure
            analytics         { market_trend, portfolio_analytics }
            context           { ranked_news, holdings_preview }
            tool_call(start)  identify_causal_links
            start             { trace_id }
            delta             { text, accumulated_len }            × N
            tool_call(done)   identify_causal_links
            briefing          { full structured AdvisorBriefing }
            tool_call(start)  self_evaluate_output
            tool_call(done)   self_evaluate_output
            evaluation        { score, causal_depth, … }
            done              { latency_ms, usage, trace_id }
            error             (anywhere on failure)
        """
        t0 = time.perf_counter()

        def tool_start(tid: str, label: str, detail: str) -> dict[str, Any]:
            return {
                "event": "tool_call",
                "data": {
                    "id": tid,
                    "label": label,
                    "detail": detail,
                    "status": "active",
                    "started_at_ms": int((time.perf_counter() - t0) * 1000),
                },
            }

        def tool_done(tid: str, started: float) -> dict[str, Any]:
            return {
                "event": "tool_call",
                "data": {
                    "id": tid,
                    "status": "done",
                    "duration_ms": int((time.perf_counter() - started) * 1000),
                },
            }

        try:
            portfolio = self.loader.get_portfolio(portfolio_id)
        except KeyError as e:
            yield {"event": "error", "data": {"error": str(e), "code": 404}}
            return

        # 1. ingest_market_data
        ts = time.perf_counter()
        yield tool_start(
            "ingest_market_data",
            "Ingesting market data",
            "NIFTY 50, SENSEX, sectoral indices",
        )
        market_snapshot = self.loader.market_snapshot
        news = self.loader.news
        universe = self.loader.sector_universe
        yield tool_done("ingest_market_data", ts)

        # 2. classify_news
        ts = time.perf_counter()
        yield tool_start(
            "classify_news",
            "Classifying news",
            f"{len(news)} headlines → sentiment + scope + entities",
        )
        market_trend = compute_market_trend(market_snapshot)
        ranked_news = rank_news_for_portfolio(news, portfolio, top_k=top_news)
        yield tool_done("classify_news", ts)

        # 3. compute_portfolio_exposure
        ts = time.perf_counter()
        yield tool_start(
            "compute_portfolio_exposure",
            "Computing portfolio exposure",
            "Sector weights vs. news entities",
        )
        analytics = compute_portfolio_analytics(portfolio)
        yield tool_done("compute_portfolio_exposure", ts)

        yield {
            "event": "analytics",
            "data": {
                "portfolio_id": portfolio_id,
                "user_name": portfolio.user_name,
                "as_of_date": market_snapshot.date,
                "market_trend": market_trend.model_dump(),
                "portfolio_analytics": analytics.model_dump(),
            },
        }

        context = build_context(
            portfolio=portfolio,
            analytics=analytics,
            ranked_news=ranked_news,
            market_trend=market_trend,
            market_snapshot=market_snapshot,
            sector_universe=universe,
        )

        yield {
            "event": "context",
            "data": {
                "ranked_news": context["ranked_news"][:5],
                "holdings_preview": context["holdings_snapshot"][:5],
            },
        }

        # 4. identify_causal_links (the LLM call itself)
        briefing_dict: dict[str, Any] | None = None
        usage: dict[str, int] = {}
        with self.tracer.trace(
            "advisor.brief_stream",
            user_id=portfolio.user_id,
            metadata={"portfolio_id": portfolio_id, "streaming": True},
        ) as trace:
            ts = time.perf_counter()
            yield tool_start(
                "identify_causal_links",
                "Identifying causal links",
                "High-impact paths only (>0.5)",
            )
            yield {"event": "start", "data": {"trace_id": trace.trace_id}}

            with trace.span("reasoning") as reasoning_span:
                try:
                    for evt in self.reasoner.reason_stream(context, span=reasoning_span):
                        if evt["kind"] == STREAM_START:
                            continue
                        if evt["kind"] == DELTA:
                            yield {
                                "event": "delta",
                                "data": {
                                    "text": evt["text"],
                                    "accumulated_len": len(evt["accumulated"]),
                                },
                            }
                        elif evt["kind"] == COMPLETE:
                            briefing_dict = evt["briefing"]
                            usage = evt["usage"]
                except ReasonerError as e:
                    yield {"event": "error", "data": {"error": str(e), "code": 502}}
                    return

            yield tool_done("identify_causal_links", ts)
            assert briefing_dict is not None

            briefing_partial = AdvisorBriefing(
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
                evaluation=None,
                trace_id=trace.trace_id,
                latency_ms=int((time.perf_counter() - t0) * 1000),
                token_usage=usage,
            )
            yield {"event": "briefing", "data": briefing_partial.model_dump()}

            # 5. self_evaluate_output
            if not skip_evaluation:
                ts = time.perf_counter()
                yield tool_start(
                    "self_evaluate_output",
                    "Self-evaluating output",
                    "Reasoning quality + coverage + confidence",
                )
                with trace.span("evaluation") as eval_span:
                    evaluation = self.evaluator.evaluate(
                        briefing_dict, context, span=eval_span
                    )
                yield tool_done("self_evaluate_output", ts)
                yield {"event": "evaluation", "data": evaluation.model_dump()}

            latency_ms = int((time.perf_counter() - t0) * 1000)
            trace.update(metadata={"latency_ms": latency_ms})

        yield {
            "event": "done",
            "data": {"latency_ms": latency_ms, "usage": usage, "trace_id": trace.trace_id},
        }
