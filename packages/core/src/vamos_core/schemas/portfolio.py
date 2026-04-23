from __future__ import annotations

from pydantic import AliasChoices, BaseModel, ConfigDict, Field

from vamos_core.schemas.common import PortfolioType, RiskProfile


class StockHolding(BaseModel):
    model_config = ConfigDict(extra="ignore")

    symbol: str
    name: str
    sector: str
    quantity: int
    avg_buy_price: float
    current_price: float
    investment_value: float
    current_value: float
    gain_loss: float
    gain_loss_percent: float
    day_change: float
    day_change_percent: float
    weight_in_portfolio: float


class MutualFundHolding(BaseModel):
    # Mock data is inconsistent: some schemes use `current_nav`, some use
    # `current_price`. Accept either via validation aliases.
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    scheme_code: str
    scheme_name: str
    category: str
    amc: str
    units: float
    avg_nav: float
    current_nav: float = Field(
        validation_alias=AliasChoices("current_nav", "current_price")
    )
    investment_value: float
    current_value: float
    gain_loss: float
    gain_loss_percent: float
    day_change: float
    day_change_percent: float
    weight_in_portfolio: float
    top_holdings: list[str] = Field(default_factory=list)


class Holdings(BaseModel):
    model_config = ConfigDict(extra="ignore")

    stocks: list[StockHolding] = Field(default_factory=list)
    mutual_funds: list[MutualFundHolding] = Field(default_factory=list)


class DaySummary(BaseModel):
    model_config = ConfigDict(extra="ignore")

    day_change_absolute: float
    day_change_percent: float
    top_gainer: dict | None = None
    top_loser: dict | None = None


class RiskMetrics(BaseModel):
    model_config = ConfigDict(extra="ignore")

    concentration_risk: bool
    single_stock_max_weight: float
    single_sector_max_weight: float
    beta: float | None = None
    volatility: str | None = None


class PortfolioAnalytics(BaseModel):
    model_config = ConfigDict(extra="ignore")

    sector_allocation: dict[str, float] = Field(default_factory=dict)
    asset_type_allocation: dict[str, float] = Field(default_factory=dict)
    risk_metrics: RiskMetrics
    day_summary: DaySummary


class Portfolio(BaseModel):
    model_config = ConfigDict(extra="ignore")

    portfolio_id: str
    user_id: str
    user_name: str
    portfolio_type: PortfolioType
    risk_profile: RiskProfile
    investment_horizon: str
    description: str
    total_investment: float
    current_value: float
    overall_gain_loss: float
    overall_gain_loss_percent: float
    holdings: Holdings
    analytics: PortfolioAnalytics | None = None
