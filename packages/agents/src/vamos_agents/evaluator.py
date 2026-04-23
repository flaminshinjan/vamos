"""Self-evaluation: LLM judge (Haiku) + rule-based checks, hybrid score.

Rule checks guard against common failure modes even when the LLM judge
is unavailable; together they give a robust quality signal.
"""

from __future__ import annotations

import logging
from typing import Any

from anthropic import Anthropic

from vamos_agents.prompts import EVALUATION_SYSTEM, build_evaluation_user_prompt
from vamos_agents.schemas import EvaluationResult
from vamos_agents.settings import Settings
from vamos_agents.tools import EVALUATION_TOOL
from vamos_agents.tracing import SpanHandle

logger = logging.getLogger(__name__)


class Evaluator:
    def __init__(self, settings: Settings, client: Anthropic | None = None) -> None:
        self.settings = settings
        self._client = client  # lazy

    def _get_client(self) -> Anthropic | None:
        if self.settings.anthropic_api_key is None:
            return None
        if self._client is None:
            self._client = Anthropic(
                api_key=self.settings.anthropic_api_key,
                timeout=self.settings.request_timeout_s,
            )
        return self._client

    # ---------------- Rule-based checks ----------------

    def _rule_checks(
        self, briefing: dict[str, Any], inputs: dict[str, Any]
    ) -> tuple[float, list[str]]:
        """Return (score_contribution_0_to_1, list_of_issues)."""
        issues: list[str] = []
        score_components: list[float] = []

        # 1. Has at least one causal chain
        chains = briefing.get("causal_chains") or []
        if not chains:
            issues.append("No causal chains provided.")
            score_components.append(0.0)
        else:
            score_components.append(1.0)

        # 2. Cited stocks are actually in holdings
        held_stocks = {
            h["symbol"]
            for h in inputs["holdings_snapshot"]
            if h["kind"] == "STOCK"
        }
        cited = {s for c in chains for s in c.get("stocks", [])}
        bad = cited - held_stocks
        if bad:
            issues.append(f"Cited stocks not in portfolio: {sorted(bad)}")
            score_components.append(0.0)
        elif cited:
            score_components.append(1.0)
        else:
            # No stocks cited — fine only if portfolio is pure MF
            score_components.append(0.5)

        # 3. Confidence is in range
        conf = briefing.get("confidence")
        if isinstance(conf, (int, float)) and 0.0 <= float(conf) <= 1.0:
            score_components.append(1.0)
        else:
            issues.append("Missing or out-of-range confidence.")
            score_components.append(0.0)

        # 4. Concentration risk surfaced when present
        concentration = inputs["portfolio_summary"].get("concentration_risk", False)
        if concentration:
            insights = briefing.get("key_insights") or []
            mentioned = any(
                i.get("severity") in {"WARN", "CRITICAL"}
                and any(
                    kw in (i.get("title", "") + i.get("detail", "")).lower()
                    for kw in ("concent", "exposure", "diversif")
                )
                for i in insights
            )
            if not mentioned:
                issues.append("Portfolio has concentration risk but briefing did not flag it.")
                score_components.append(0.0)
            else:
                score_components.append(1.0)
        else:
            score_components.append(1.0)

        # 5. Conflict signals surfaced when data shows conflicting headlines
        # (e.g., positive news article on a stock whose price fell)
        expected_conflicts = _detect_expected_conflicts(inputs)
        reported_conflicts = briefing.get("conflicts") or []
        if expected_conflicts and not reported_conflicts:
            issues.append(
                f"Expected conflict signals for {expected_conflicts} — not reported."
            )
            score_components.append(0.3)
        else:
            score_components.append(1.0)

        rule_score = sum(score_components) / len(score_components)
        return rule_score, issues

    # ---------------- LLM judge ----------------

    def _llm_judge(
        self,
        briefing: dict[str, Any],
        inputs: dict[str, Any],
        span: SpanHandle | None = None,
    ) -> dict[str, Any] | None:
        client = self._get_client()
        if client is None:
            return None

        # Compact inputs — the judge doesn't need the full raw market snapshot
        trimmed = {
            "portfolio_summary": inputs["portfolio_summary"],
            "holdings": inputs["holdings_snapshot"],
            "relevant_news": [
                {
                    "id": n["id"],
                    "headline": n["headline"],
                    "sentiment": n["sentiment"],
                    "scope": n["scope"],
                    "impact_level": n["impact_level"],
                    "stocks": n["stocks"],
                    "sectors": n["sectors"],
                }
                for n in inputs["ranked_news"]
            ],
            "market": {
                "sentiment": inputs["market_trend"]["overall_sentiment"],
                "index_snapshot": inputs["market_trend"]["index_snapshot"],
            },
        }
        user_msg = build_evaluation_user_prompt(inputs=trimmed, briefing=briefing)
        try:
            response = client.messages.create(
                model=self.settings.eval_model,
                max_tokens=1024,
                system=EVALUATION_SYSTEM,
                tools=[EVALUATION_TOOL],
                tool_choice={"type": "tool", "name": EVALUATION_TOOL["name"]},
                messages=[{"role": "user", "content": user_msg}],
            )
        except Exception as e:
            logger.warning("LLM judge failed — falling back to rule-only eval: %s", e)
            return None

        for block in response.content:
            if getattr(block, "type", None) == "tool_use":
                result = block.input
                if span is not None:
                    span.log_generation(
                        model=self.settings.eval_model,
                        input=user_msg[:800],
                        output=result,
                        usage={
                            "input_tokens": getattr(response.usage, "input_tokens", 0),
                            "output_tokens": getattr(response.usage, "output_tokens", 0),
                        },
                    )
                return result  # type: ignore[no-any-return]
        return None

    # ---------------- Public API ----------------

    def evaluate(
        self,
        briefing: dict[str, Any],
        inputs: dict[str, Any],
        *,
        span: SpanHandle | None = None,
    ) -> EvaluationResult:
        rule_score, rule_issues = self._rule_checks(briefing, inputs)
        llm = self._llm_judge(briefing, inputs, span=span)

        if llm is None:
            # Rules-only fallback
            return EvaluationResult(
                score=round(rule_score, 3),
                grounded=(rule_score >= 0.7),
                causal_depth="MODERATE" if rule_score > 0.6 else "SHALLOW",
                missing_elements=rule_issues,
                rationale=(
                    "LLM judge unavailable — score is from rule checks only. "
                    f"Rule pass rate: {rule_score:.0%}."
                ),
                method="rules_only",
            )

        llm_score = float(llm.get("score", 0.0))
        blended = 0.6 * llm_score + 0.4 * rule_score
        return EvaluationResult(
            score=round(blended, 3),
            grounded=bool(llm.get("grounded", False)) and rule_score >= 0.5,
            causal_depth=llm.get("causal_depth", "MODERATE"),
            missing_elements=list(llm.get("missing_elements", [])) + rule_issues,
            rationale=f"{llm.get('rationale', '')} | Rule checks: {rule_score:.0%}",
            method="hybrid",
        )


def _detect_expected_conflicts(inputs: dict[str, Any]) -> list[str]:
    """Find stocks where we'd expect a conflict flag: strong positive news
    but negative day price action (or vice versa).
    """
    price_by_symbol = {
        h["symbol"]: h["day_change_pct"]
        for h in inputs["holdings_snapshot"]
        if h["kind"] == "STOCK"
    }
    conflicts: list[str] = []
    for n in inputs["ranked_news"]:
        if n["scope"] != "STOCK_SPECIFIC":
            continue
        sentiment = n["sentiment"]
        for symbol in n["stocks"]:
            if symbol not in price_by_symbol:
                continue
            change = price_by_symbol[symbol]
            if sentiment == "POSITIVE" and change < -1.0:
                conflicts.append(symbol)
            elif sentiment == "NEGATIVE" and change > 1.0:
                conflicts.append(symbol)
    return sorted(set(conflicts))
