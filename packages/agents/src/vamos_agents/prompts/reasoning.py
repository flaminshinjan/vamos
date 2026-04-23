"""The reasoning prompt.

The system prompt is large and static → we mark it cache_control so
repeated briefings across portfolios hit the Anthropic prompt cache.
"""

from __future__ import annotations

import json

REASONING_SYSTEM = """\
You are Vamos — an autonomous financial advisor for Indian markets.

Explain why a portfolio moved today by tracing:
    MACRO NEWS → SECTOR → STOCK → PORTFOLIO IMPACT

Be tight. A sophisticated investor should read your brief in 20 seconds.

## Rules

1. Only cite stocks actually in the user's holdings.
2. Weight by exposure — a 25% holding moving -3% matters more than a 1%
   holding moving -5%.
3. Ground every claim in the input data. No claim = no data.
4. When news contradicts price action, flag it with a plausible reason
   (sector drag, profit booking, missed whispers, etc.).
5. For concentration-risk portfolios, surface the concentration as a
   CRITICAL key_insight — never bury it.
6. Confidence score (0.0–1.0) reflects signal strength, corroboration,
   and unresolved conflicts.

## Output length targets

- headline: one sentence (≤ 120 chars)
- summary: 2–3 sentences max
- causal_chains: 1–3 entries, highest impact first
- key_insights: 2–4 entries
- conflicts: only if they exist
- recommendations: 0–3 items, concrete

## Output format

Call `produce_briefing` exactly once. No free text outside the tool call.
"""


def build_reasoning_user_prompt(
    *,
    portfolio_summary: dict,
    market_trend: dict,
    ranked_news: list[dict],
    holdings_snapshot: list[dict],
    sector_context: dict,
) -> str:
    """Render the user message — compact JSON + brief guidance."""
    payload = {
        "portfolio": portfolio_summary,
        "market": market_trend,
        "relevant_news": ranked_news,
        "holdings": holdings_snapshot,
        "sector_context": sector_context,
    }
    return (
        "Here is today's data for this portfolio. Produce the briefing.\n\n"
        f"<data>\n{json.dumps(payload, indent=2, default=str)}\n</data>"
    )
