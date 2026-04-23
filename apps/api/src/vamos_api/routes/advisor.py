"""Advisor endpoint — runs the full agent pipeline."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from vamos_agents.advisor import AdvisorAgent
from vamos_agents.reasoner import ReasonerError
from vamos_agents.schemas import AdvisorBriefing

from vamos_api.core.deps import get_advisor

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
    """Generate the full causal briefing for a portfolio."""
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
