"""Portfolio analytics: recompute P&L, allocation, and risk from holdings.

We intentionally recompute instead of trusting the pre-baked `analytics`
block in portfolios.json. The mock data's `analytics` is used as *ground
truth* for tests.
"""

from __future__ import annotations

from collections import defaultdict

from pydantic import BaseModel, Field

from vamos_core.schemas.portfolio import Portfolio

# Thresholds for risk detection
_SINGLE_SECTOR_THRESHOLD = 40.0  # % of portfolio
_SINGLE_STOCK_THRESHOLD = 20.0  # % of portfolio


class ConcentrationAlert(BaseModel):
    level: str  # "CRITICAL" | "HIGH" | "MODERATE"
    kind: str  # "SECTOR" | "STOCK"
    name: str
    weight_percent: float
    message: str


class DaySummary(BaseModel):
    day_change_absolute: float
    day_change_percent: float
    top_gainer: dict | None = None
    top_loser: dict | None = None


class PortfolioAnalyticsResult(BaseModel):
    portfolio_id: str
    total_investment: float
    current_value: float
    overall_gain_loss: float
    overall_gain_loss_percent: float
    day_summary: DaySummary

    sector_allocation: dict[str, float] = Field(default_factory=dict)
    asset_type_allocation: dict[str, float] = Field(default_factory=dict)

    single_stock_max_weight: float
    single_sector_max_weight: float
    concentration_risk: bool
    alerts: list[ConcentrationAlert] = Field(default_factory=list)


def _round(x: float, d: int = 2) -> float:
    return round(x, d)


def compute_portfolio_analytics(portfolio: Portfolio) -> PortfolioAnalyticsResult:
    stocks = portfolio.holdings.stocks
    mfs = portfolio.holdings.mutual_funds

    total_current = sum(h.current_value for h in stocks) + sum(
        m.current_value for m in mfs
    )
    total_invested = sum(h.investment_value for h in stocks) + sum(
        m.investment_value for m in mfs
    )
    overall_gl = total_current - total_invested
    overall_gl_pct = (overall_gl / total_invested * 100) if total_invested else 0.0

    day_change_abs = sum(h.day_change for h in stocks) + sum(
        m.day_change for m in mfs
    )
    # Day change % is weighted avg of holdings, computed from absolute change
    # vs previous day value (current_value - day_change ≈ prev value).
    prev_value = total_current - day_change_abs
    day_change_pct = (day_change_abs / prev_value * 100) if prev_value else 0.0

    # Sector allocation — direct stocks attribute to their sector, MFs to a
    # synthetic 'DIVERSIFIED_MF' bucket. Could be refined to penetrate MF
    # top-holdings; keeping parity with mock's analytics.
    sector_alloc_abs: dict[str, float] = defaultdict(float)
    for h in stocks:
        sector_alloc_abs[h.sector] += h.current_value
    if mfs:
        sector_alloc_abs["DIVERSIFIED_MF"] += sum(m.current_value for m in mfs)
    sector_alloc = {
        k: _round(v / total_current * 100) for k, v in sector_alloc_abs.items()
    }

    # Asset-type split
    stocks_value = sum(h.current_value for h in stocks)
    mf_value = sum(m.current_value for m in mfs)
    asset_type = {
        "DIRECT_STOCKS": _round(stocks_value / total_current * 100) if total_current else 0.0,
        "MUTUAL_FUNDS": _round(mf_value / total_current * 100) if total_current else 0.0,
    }

    # Risk metrics — max sector excludes the DIVERSIFIED_MF bucket since it's
    # not a single sector bet; it's a pool of diversified funds.
    single_stock_max = max((h.weight_in_portfolio for h in stocks), default=0.0)
    equity_sector_alloc = {k: v for k, v in sector_alloc.items() if k != "DIVERSIFIED_MF"}
    single_sector_max = max(equity_sector_alloc.values(), default=0.0)
    # Exclude DIVERSIFIED_MF from concentration alerts (it's a bucket, not a sector bet)
    concentrated_sectors = {
        k: v for k, v in sector_alloc.items()
        if k != "DIVERSIFIED_MF" and v >= _SINGLE_SECTOR_THRESHOLD
    }

    alerts: list[ConcentrationAlert] = []
    for sec, weight in concentrated_sectors.items():
        level = "CRITICAL" if weight >= 60 else "HIGH"
        alerts.append(
            ConcentrationAlert(
                level=level,
                kind="SECTOR",
                name=sec,
                weight_percent=weight,
                message=(
                    f"{weight:.1f}% exposure to {sec} — above "
                    f"{_SINGLE_SECTOR_THRESHOLD}% threshold."
                ),
            )
        )
    for h in stocks:
        if h.weight_in_portfolio >= _SINGLE_STOCK_THRESHOLD:
            alerts.append(
                ConcentrationAlert(
                    level="HIGH",
                    kind="STOCK",
                    name=h.symbol,
                    weight_percent=h.weight_in_portfolio,
                    message=(
                        f"{h.weight_in_portfolio:.1f}% of portfolio is in a "
                        f"single stock ({h.symbol})."
                    ),
                )
            )

    has_concentration = bool(alerts)

    # Top movers among holdings
    all_holdings_movers = [
        (h.symbol, h.day_change_percent, h.day_change) for h in stocks
    ] + [(m.scheme_code, m.day_change_percent, m.day_change) for m in mfs]
    top_gainer = max(all_holdings_movers, key=lambda t: t[1], default=None)
    top_loser = min(all_holdings_movers, key=lambda t: t[1], default=None)

    return PortfolioAnalyticsResult(
        portfolio_id=portfolio.portfolio_id,
        total_investment=_round(total_invested),
        current_value=_round(total_current),
        overall_gain_loss=_round(overall_gl),
        overall_gain_loss_percent=_round(overall_gl_pct),
        day_summary=DaySummary(
            day_change_absolute=_round(day_change_abs),
            day_change_percent=_round(day_change_pct),
            top_gainer={"symbol": top_gainer[0], "change_percent": top_gainer[1]}
            if top_gainer
            else None,
            top_loser={"symbol": top_loser[0], "change_percent": top_loser[1]}
            if top_loser
            else None,
        ),
        sector_allocation=sector_alloc,
        asset_type_allocation=asset_type,
        single_stock_max_weight=_round(single_stock_max),
        single_sector_max_weight=_round(single_sector_max),
        concentration_risk=has_concentration,
        alerts=alerts,
    )
