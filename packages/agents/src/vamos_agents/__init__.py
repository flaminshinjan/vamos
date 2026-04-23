"""The reasoning layer.

Public API:
- AdvisorAgent: orchestrates context → reasoning → evaluation
- AdvisorBriefing: typed output
- settings: runtime config
"""

from vamos_agents.advisor import AdvisorAgent
from vamos_agents.schemas import (
    AdvisorBriefing,
    CausalChain,
    EvaluationResult,
    KeyInsight,
)
from vamos_agents.settings import Settings, get_settings

__all__ = [
    "AdvisorAgent",
    "AdvisorBriefing",
    "CausalChain",
    "EvaluationResult",
    "KeyInsight",
    "Settings",
    "get_settings",
]
