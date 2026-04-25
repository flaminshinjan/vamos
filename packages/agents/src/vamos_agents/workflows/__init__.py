"""Multi-step workflows the chat agent dispatches to."""

from vamos_agents.workflows._deps import WorkflowDeps
from vamos_agents.workflows.future_prediction import forecast_market
from vamos_agents.workflows.market_lookup import lookup_market
from vamos_agents.workflows.portfolio_explain import (
    compare_portfolio_to_market,
    explain_portfolio_move,
    show_my_mutual_funds,
)
from vamos_agents.workflows.sector_performance import lookup_sector
from vamos_agents.workflows.stock_diagnosis import diagnose_stock, lookup_stock
from vamos_agents.workflows.trend_scan import scan_trends

__all__ = [
    "WorkflowDeps",
    "compare_portfolio_to_market",
    "diagnose_stock",
    "explain_portfolio_move",
    "forecast_market",
    "lookup_market",
    "lookup_sector",
    "lookup_stock",
    "scan_trends",
    "show_my_mutual_funds",
]
