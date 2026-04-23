"""The causal reasoner — one Claude call, tool-use for structured output,
prompt caching on the system prompt.
"""

from __future__ import annotations

import logging
from typing import Any

from anthropic import Anthropic

from vamos_agents.prompts import REASONING_SYSTEM, build_reasoning_user_prompt
from vamos_agents.settings import Settings
from vamos_agents.tools import BRIEFING_TOOL
from vamos_agents.tracing import SpanHandle

logger = logging.getLogger(__name__)


class ReasonerError(RuntimeError):
    pass


class Reasoner:
    def __init__(self, settings: Settings, client: Anthropic | None = None) -> None:
        self.settings = settings
        self._injected_client = client
        self._client: Anthropic | None = client

    def _get_client(self) -> Anthropic:
        if self._client is not None:
            return self._client
        if not self.settings.anthropic_api_key:
            raise ReasonerError(
                "ANTHROPIC_API_KEY is required. Set it in the environment."
            )
        self._client = Anthropic(
            api_key=self.settings.anthropic_api_key,
            timeout=self.settings.request_timeout_s,
        )
        return self._client

    def reason(
        self,
        context: dict[str, Any],
        *,
        span: SpanHandle | None = None,
    ) -> tuple[dict[str, Any], dict[str, int]]:
        """Run a single reasoning turn. Returns (briefing_dict, token_usage)."""
        user_msg = build_reasoning_user_prompt(
            portfolio_summary=context["portfolio_summary"],
            market_trend=context["market_trend"],
            ranked_news=context["ranked_news"],
            holdings_snapshot=context["holdings_snapshot"],
            sector_context=context["sector_context"],
        )

        # System prompt is long and stable → cache it.
        system_blocks: list[dict[str, Any]] = [
            {
                "type": "text",
                "text": REASONING_SYSTEM,
                "cache_control": {"type": "ephemeral"},
            }
        ]

        try:
            response = self._get_client().messages.create(
                model=self.settings.reasoning_model,
                max_tokens=self.settings.max_output_tokens,
                system=system_blocks,
                tools=[BRIEFING_TOOL],
                tool_choice={"type": "tool", "name": BRIEFING_TOOL["name"]},
                messages=[{"role": "user", "content": user_msg}],
            )
        except Exception as e:
            logger.exception("Reasoner LLM call failed")
            raise ReasonerError(f"Anthropic call failed: {e}") from e

        briefing = _extract_tool_input(response)

        usage = {
            "input_tokens": getattr(response.usage, "input_tokens", 0),
            "output_tokens": getattr(response.usage, "output_tokens", 0),
            "cache_read_input_tokens": getattr(
                response.usage, "cache_read_input_tokens", 0
            ),
            "cache_creation_input_tokens": getattr(
                response.usage, "cache_creation_input_tokens", 0
            ),
        }

        if span is not None:
            span.log_generation(
                model=self.settings.reasoning_model,
                input={"system": REASONING_SYSTEM[:500] + "...", "user": user_msg[:1500]},
                output=briefing,
                usage=usage,
                metadata={"tool": BRIEFING_TOOL["name"]},
            )

        return briefing, usage


def _extract_tool_input(response: Any) -> dict[str, Any]:
    """Grab the tool_use block from Claude's response."""
    for block in response.content:
        if getattr(block, "type", None) == "tool_use":
            return block.input  # type: ignore[no-any-return]
    raise ReasonerError(
        f"No tool_use block in response. stop_reason={response.stop_reason}"
    )
