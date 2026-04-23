"""Advisor endpoints — chat agent + full briefing pipeline.

    POST /advisor/chat/stream   → conversational agent (Claude drives)
    POST /advisor/brief         → single blocking briefing (legacy)
    POST /advisor/brief/stream  → streamed briefing
"""

from __future__ import annotations

import json
import logging
from typing import Iterator

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from vamos_agents.advisor import AdvisorAgent
from vamos_agents.chat_agent import chat_stream
from vamos_agents.reasoner import ReasonerError
from vamos_agents.schemas import AdvisorBriefing
from vamos_agents.settings import get_settings
from vamos_core import DataLoader

from vamos_api.core.deps import get_advisor, get_data_loader

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/advisor", tags=["advisor"])


class BriefRequest(BaseModel):
    portfolio_id: str
    top_news: int = Field(default=8, ge=1, le=25)
    skip_evaluation: bool = False


@router.post("/brief", response_model=AdvisorBriefing)
def brief(
    req: BriefRequest, advisor: AdvisorAgent = Depends(get_advisor)
) -> AdvisorBriefing:
    """Generate the full causal briefing for a portfolio (blocking)."""
    try:
        return advisor.brief(
            req.portfolio_id,
            top_news=req.top_news,
            skip_evaluation=req.skip_evaluation,
        )
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ReasonerError as e:
        logger.exception("Reasoner failed")
        raise HTTPException(status_code=502, detail=f"Reasoning failed: {e}")
    except Exception as e:
        logger.exception("Advisor crashed")
        raise HTTPException(status_code=500, detail=f"Internal error: {e}")


def _format_sse(event: str, data: dict) -> bytes:
    """Encode a dict as one SSE frame."""
    payload = json.dumps(data, default=str)
    return f"event: {event}\ndata: {payload}\n\n".encode("utf-8")


@router.post("/brief/stream")
def brief_stream(
    req: BriefRequest, advisor: AdvisorAgent = Depends(get_advisor)
) -> StreamingResponse:
    """Stream the briefing as Server-Sent Events.

    Events: analytics, context, start, delta, briefing, evaluation, done, error.
    """

    def generate() -> Iterator[bytes]:
        try:
            for event in advisor.brief_stream(
                req.portfolio_id,
                top_news=req.top_news,
                skip_evaluation=req.skip_evaluation,
            ):
                yield _format_sse(event["event"], event.get("data", {}))
        except Exception as e:
            logger.exception("Stream crashed")
            yield _format_sse("error", {"error": str(e), "code": 500})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",  # disable nginx/proxy buffering
            "Connection": "keep-alive",
        },
    )


# ── Chat agent endpoint — every user message goes through Claude ────

class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    portfolio_id: str
    message: str
    history: list[ChatMessage] = Field(default_factory=list)


@router.post("/chat/stream")
def chat_stream_endpoint(
    req: ChatRequest,
    advisor: AdvisorAgent = Depends(get_advisor),
    loader: DataLoader = Depends(get_data_loader),
) -> StreamingResponse:
    """Conversational agent. Claude decides whether to reply with text,
    render a data card, or trigger the full briefing pipeline.
    """

    def generate() -> Iterator[bytes]:
        try:
            history = [m.model_dump() for m in req.history]
            for event in chat_stream(
                loader=loader,
                portfolio_id=req.portfolio_id,
                user_message=req.message,
                history=history,
                settings=get_settings(),
                advisor=advisor,
            ):
                yield _format_sse(event["event"], event.get("data", {}))
        except Exception as e:
            logger.exception("Chat stream crashed")
            yield _format_sse("error", {"error": str(e), "code": 500})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
