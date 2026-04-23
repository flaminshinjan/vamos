"""JSON schemas for Claude tool-use.

We use tool use purely for *structured output* — Claude returns exactly
one tool call containing the briefing. This is more reliable than JSON
mode and gives us free schema validation on the model side.
"""

from __future__ import annotations

BRIEFING_TOOL = {
    "name": "produce_briefing",
    "description": (
        "Emit the final AdvisorBriefing. Call this tool exactly once with "
        "the full structured briefing."
    ),
    "input_schema": {
        "type": "object",
        "required": [
            "headline",
            "summary",
            "causal_chains",
            "key_insights",
            "confidence",
            "confidence_rationale",
        ],
        "properties": {
            "headline": {
                "type": "string",
                "description": "One-sentence summary of today's portfolio story.",
            },
            "summary": {
                "type": "string",
                "description": "2–4 sentence plain-English explanation of the day.",
            },
            "causal_chains": {
                "type": "array",
                "description": "News → Sector → Stock → Portfolio linkages, highest-impact first.",
                "items": {
                    "type": "object",
                    "required": [
                        "trigger",
                        "sector",
                        "sector_impact_pct",
                        "stocks",
                        "portfolio_impact_pct",
                        "narrative",
                    ],
                    "properties": {
                        "trigger": {"type": "string"},
                        "sector": {"type": "string"},
                        "sector_impact_pct": {"type": "number"},
                        "stocks": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Affected holdings only — symbols that are in this portfolio.",
                        },
                        "portfolio_impact_pct": {"type": "number"},
                        "narrative": {"type": "string"},
                    },
                },
            },
            "key_insights": {
                "type": "array",
                "description": "3–5 highlights the user should notice.",
                "items": {
                    "type": "object",
                    "required": ["title", "detail", "severity"],
                    "properties": {
                        "title": {"type": "string"},
                        "detail": {"type": "string"},
                        "severity": {
                            "type": "string",
                            "enum": ["INFO", "WARN", "CRITICAL"],
                        },
                    },
                },
            },
            "conflicts": {
                "type": "array",
                "description": "Cases where news and price action disagree.",
                "items": {
                    "type": "object",
                    "required": [
                        "stock_or_sector",
                        "news_signal",
                        "price_signal",
                        "explanation",
                    ],
                    "properties": {
                        "stock_or_sector": {"type": "string"},
                        "news_signal": {"type": "string"},
                        "price_signal": {"type": "string"},
                        "explanation": {"type": "string"},
                    },
                },
            },
            "recommendations": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Optional, concrete suggestions (e.g. 'rebalance BANKING exposure below 40%').",
            },
            "confidence": {
                "type": "number",
                "minimum": 0.0,
                "maximum": 1.0,
                "description": "How confident the agent is in this briefing.",
            },
            "confidence_rationale": {
                "type": "string",
                "description": "Brief justification for the confidence score.",
            },
        },
    },
}


EVALUATION_TOOL = {
    "name": "score_briefing",
    "description": "Grade the quality of the advisor's briefing.",
    "input_schema": {
        "type": "object",
        "required": ["score", "grounded", "causal_depth", "missing_elements", "rationale"],
        "properties": {
            "score": {
                "type": "number",
                "minimum": 0.0,
                "maximum": 1.0,
            },
            "grounded": {
                "type": "boolean",
                "description": "True if every factual claim traces back to the input data.",
            },
            "causal_depth": {
                "type": "string",
                "enum": ["SHALLOW", "MODERATE", "DEEP"],
            },
            "missing_elements": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Things the briefing should have mentioned but didn't.",
            },
            "rationale": {
                "type": "string",
                "description": "Brief explanation of the score.",
            },
        },
    },
}
