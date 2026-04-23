"""Self-evaluation prompt — a smaller model grades the briefing."""

from __future__ import annotations

import json

EVALUATION_SYSTEM = """\
You are an evaluator for a financial advisor agent.

You are given: (a) the raw input data the agent received, and (b) the
agent's briefing. Score the briefing on these criteria:

1. GROUNDED — does every factual claim trace back to the input data?
2. CAUSAL DEPTH — does the brief actually link News → Sector → Stock →
   Portfolio, or does it just restate numbers?
3. PRIORITIZATION — does it surface the HIGHEST-impact driver first?
4. CONFLICT HANDLING — if news and price disagree, is that flagged?
5. CONCENTRATION RISK — if the portfolio is concentrated (>40% in one
   sector, or >20% in one stock), is that called out?

You MUST call the `score_briefing` tool exactly once.
"""


def build_evaluation_user_prompt(
    *,
    inputs: dict,
    briefing: dict,
) -> str:
    return (
        "## Inputs the agent received\n"
        f"<inputs>\n{json.dumps(inputs, indent=2, default=str)}\n</inputs>\n\n"
        "## Briefing the agent produced\n"
        f"<briefing>\n{json.dumps(briefing, indent=2, default=str)}\n</briefing>\n\n"
        "Score this briefing now."
    )
