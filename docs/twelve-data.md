# Twelve Data integration — future work

Today the chat agent's stock and trend data comes entirely from SerpApi
(`google_finance` for quotes/historical graphs, `google_news` for
headlines). That works well enough to ship, but Google Finance has two
real limits we'll hit eventually:

1. **Coverage of Indian instruments is patchy** — sector indices and
   smaller-cap stocks sometimes return no `summary` block.
2. **Historical granularity is coarse** — the `graph` array we get back
   is whatever Google's UI would have rendered; we can't ask for
   "explicit daily closes for the last 30 trading days." Momentum math
   is approximate as a result.

[Twelve Data](https://twelvedata.com) gives us proper OHLC, configurable
intervals, and a wider Indian-listings catalog. This document is a sketch
of how it would slot back in when we're ready.

---

## Where it would live

A second provider alongside SerpApi:

```
packages/agents/src/vamos_agents/providers/
├── base.py           # shared (TTL cache, http_get_json) — already exists
├── serpapi.py        # already exists
└── twelve_data.py    # new — see shape below
```

Plus a `get_twelve_data(settings) -> TwelveDataClient | None` factory in
`providers/__init__.py`, mirroring `get_serpapi`.

## Settings + env

```python
# packages/agents/src/vamos_agents/settings.py
@dataclass(frozen=True)
class Settings:
    ...
    twelve_data_key: str | None
```

```bash
# .env.example
TWELVE_DATA_API_KEY=
```

## Client surface

```python
class TwelveDataClient:
    def quote(self, symbol: str) -> dict: ...
    def time_series(
        self, symbol: str, *, interval: str = "1day", outputsize: int = 30
    ) -> dict: ...

def normalize_nse_symbol(symbol: str) -> str:
    """Append `.NSE` when the caller didn't supply an exchange suffix.
    Example: 'INFY' → 'INFY.NSE'."""
```

Endpoints:

| Method | URL | Notes |
|---|---|---|
| `quote` | `GET https://api.twelvedata.com/quote` | params: `symbol`, `apikey` |
| `time_series` | `GET https://api.twelvedata.com/time_series` | params: `symbol`, `interval`, `outputsize`, `apikey` |

Both return 200 with `{"status": "error", "message": "..."}` on bad
symbols — wrap in `ProviderError` for parity with the SerpApi client.

## Workflow swaps

The chat agent's workflows already isolate the data source behind small
helpers, so the migration is mechanical:

| Workflow | Today (SerpApi) | After (Twelve Data) |
|---|---|---|
| `lookup_stock` | `serp.google_finance(finance_query(sym))` | `twelve.quote(sym)` → `StockQuote.from_twelvedata(...)` |
| `diagnose_stock` | `serp.google_finance(...)` for the quote, `serp.search_news(...)` for headlines | `twelve.quote(...)` for the quote; news still SerpApi |
| `forecast_market` | `serp.google_finance("NIFTY_50:INDEXNSE", window="1M")` | `twelve.time_series("NIFTY", interval="1day", outputsize=30)` |
| `sector_performance` | `serp.google_finance(<sector index>)` | `twelve.quote(<sector index symbol>)` (NIFTY BANK, NIFTY IT, …) |
| `scan_trends` | per-holding `serp.google_finance(..., window="1M")` | per-holding `twelve.time_series(..., outputsize=25)` |

`StockQuote` would gain a `from_twelvedata(symbol, raw)` classmethod next
to `from_serpapi_finance` so call sites swap a single line.

## What this buys us

- **Cleaner momentum math** — daily closes guaranteed, no graph-array
  guesswork in `_momentum_pct`.
- **OHLC fields** — `open`, `high`, `low`, `previous_close` populate on
  the `StockQuote` (currently `None` because Google Finance doesn't
  expose them on the summary card).
- **Higher rate limits at lower cost** — Twelve Data's free tier covers
  the per-holding fan-out in `scan_trends` more comfortably than
  SerpApi's per-call billing.

## What stays on SerpApi

News. Twelve Data's news endpoint is thin and US-skewed; Google News via
SerpApi is the better source for Indian market headlines. The
`google_news`-driven steps in `forecast_market` and `diagnose_stock`
should not change.
