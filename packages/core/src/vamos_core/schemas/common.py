from enum import Enum


class Sentiment(str, Enum):
    BULLISH = "BULLISH"
    BEARISH = "BEARISH"
    NEUTRAL = "NEUTRAL"
    POSITIVE = "POSITIVE"
    NEGATIVE = "NEGATIVE"
    MIXED = "MIXED"


class NewsScope(str, Enum):
    MARKET_WIDE = "MARKET_WIDE"
    SECTOR_SPECIFIC = "SECTOR_SPECIFIC"
    STOCK_SPECIFIC = "STOCK_SPECIFIC"


class ImpactLevel(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class RiskProfile(str, Enum):
    CONSERVATIVE = "CONSERVATIVE"
    MODERATE = "MODERATE"
    AGGRESSIVE = "AGGRESSIVE"


class PortfolioType(str, Enum):
    DIVERSIFIED = "DIVERSIFIED"
    SECTOR_CONCENTRATED = "SECTOR_CONCENTRATED"
    CONSERVATIVE = "CONSERVATIVE"
