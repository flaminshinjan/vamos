from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class SectorInfo(BaseModel):
    model_config = ConfigDict(extra="ignore")

    sector: str
    description: str
    index: str | None = None
    sub_sectors: list[str] = Field(default_factory=list)
    rate_sensitive: bool = False
    key_metrics: list[str] = Field(default_factory=list)
    stocks: list[str] = Field(default_factory=list)


class SectorUniverse(BaseModel):
    """The complete sector map + macro correlations (what moves what)."""

    sectors: dict[str, SectorInfo]
    macro_correlations: dict[str, dict[str, list[str]]]
    defensive_sectors: list[str] = Field(default_factory=list)
    cyclical_sectors: list[str] = Field(default_factory=list)
    rate_sensitive_sectors: list[str] = Field(default_factory=list)
    export_oriented_sectors: list[str] = Field(default_factory=list)
