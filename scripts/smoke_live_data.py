"""Verify portfolio prices and news are actually live (not mock JSON).

Two checks:
  1. After enrichment, at least one stock holding has a current_price that
     differs from its mock value in data/portfolios.json.
  2. After fetch_live_news, returned articles have ids prefixed 'live-' (the
     stable_id format used by the live classifier; mock data uses 'NEWS-XXX').
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / "packages/agents/src"))
sys.path.insert(0, str(REPO / "packages/core/src"))

env_path = REPO / ".env"
if env_path.exists():
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

from anthropic import Anthropic  # noqa: E402

from vamos_agents.live_data import (  # noqa: E402
    enrich_portfolio_with_live_quotes,
    fetch_live_news,
    reset_caches,
)
from vamos_agents.providers import get_serpapi  # noqa: E402
from vamos_agents.settings import get_settings  # noqa: E402
from vamos_core import DataLoader  # noqa: E402


def main() -> int:
    settings = get_settings()
    serp = get_serpapi(settings)
    if serp is None:
        print("SERPAPI_KEY not set — can't verify live data path")
        return 1
    client = Anthropic(api_key=settings.anthropic_api_key, timeout=settings.request_timeout_s)

    loader = DataLoader(str(REPO / "data"))
    portfolio = loader.get_portfolio("PORTFOLIO_001")

    # Snapshot mock prices for comparison
    mock_prices = {h.symbol: h.current_price for h in portfolio.holdings.stocks}
    print("Mock prices:", mock_prices)
    print()

    print("== 1. enrich_portfolio_with_live_quotes ==")
    enriched, prices_live = enrich_portfolio_with_live_quotes(portfolio, serp=serp)
    print(f"prices_live: {prices_live}")
    diffs = 0
    for h in enriched.holdings.stocks:
        m = mock_prices.get(h.symbol, 0)
        if abs(h.current_price - m) > 0.01:
            diffs += 1
            print(f"  {h.symbol}: mock={m:.2f}  live={h.current_price:.2f}  "
                  f"day={h.day_change_percent:+.2f}%")
    print(f"Refreshed prices differ from mock: {diffs}/{len(enriched.holdings.stocks)}")
    print(f"New portfolio current_value: {enriched.current_value:,.0f} (mock was {portfolio.current_value:,.0f})")
    print(f"New overall_gain_loss_percent: {enriched.overall_gain_loss_percent:+.2f}% "
          f"(mock was {portfolio.overall_gain_loss_percent:+.2f}%)")
    print()

    print("== 2. fetch_live_news ==")
    reset_caches()
    articles, news_live = fetch_live_news(
        enriched, serp=serp, anthropic=client, settings=settings, fallback=loader.news,
    )
    print(f"news_live: {news_live}")
    print(f"Returned {len(articles)} articles")
    live_count = sum(1 for a in articles if a.id.startswith("live-"))
    print(f"  IDs prefixed 'live-': {live_count}/{len(articles)}")
    if articles:
        print(f"\nFirst 3 live articles:")
        for a in articles[:3]:
            print(f"  - [{a.sentiment.value}/{a.scope.value}/{a.impact_level.value}] {a.headline[:90]}")
            print(f"    src={a.source}  date={a.published_at}  id={a.id}")
            print(f"    sectors={a.entities.sectors}  stocks={a.entities.stocks}  causal={a.causal_factors}")
    print()

    failed = 0
    if not prices_live:
        print("FAIL: prices_live should be True"); failed += 1
    if diffs == 0:
        print("FAIL: at least one price should differ from mock"); failed += 1
    if not news_live:
        print("FAIL: news_live should be True"); failed += 1
    if live_count == 0:
        print("FAIL: at least one article should have 'live-' id prefix"); failed += 1

    print(f"=== {failed} failures ===")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
