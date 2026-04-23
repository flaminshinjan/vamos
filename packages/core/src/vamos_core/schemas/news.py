from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from vamos_core.schemas.common import ImpactLevel, NewsScope, Sentiment


class NewsEntities(BaseModel):
    model_config = ConfigDict(extra="ignore")

    sectors: list[str] = Field(default_factory=list)
    stocks: list[str] = Field(default_factory=list)
    indices: list[str] = Field(default_factory=list)
    keywords: list[str] = Field(default_factory=list)


class NewsArticle(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    headline: str
    summary: str
    published_at: str
    source: str
    sentiment: Sentiment
    sentiment_score: float
    scope: NewsScope
    impact_level: ImpactLevel
    entities: NewsEntities = Field(default_factory=NewsEntities)
    causal_factors: list[str] = Field(default_factory=list)

    def mentions_sector(self, sector: str) -> bool:
        return sector in self.entities.sectors

    def mentions_stock(self, symbol: str) -> bool:
        return symbol in self.entities.stocks
