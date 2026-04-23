# Aarthik — Autonomous Financial Advisor Agent

An agent that doesn't report data, it **reasons** about it.

Given a user's portfolio, today's market snapshot, and a feed of financial
news, Aarthik produces a concise, causal briefing:

> **"Your portfolio fell 2.73% primarily because the RBI's hawkish stance
> today hit the banking sector (-2.45%), and 72% of your holdings sit in
> banking — HDFC Bank alone contributed more than half of the drawdown."**

It does this by chaining:

```
Macro News  →  Sector Trend  →  Individual Stock  →  Portfolio Impact
```

…and grading its own output, so you know when to trust it.

---

## Table of contents

1. [What's inside](#whats-inside)
2. [Architecture](#architecture)
3. [Quickstart](#quickstart)
4. [How the agent works](#how-the-agent-works)
5. [API reference](#api-reference)
6. [CLI reference](#cli-reference)
7. [Observability](#observability)
8. [Evaluation layer](#evaluation-layer)
9. [Deployment](#deployment)
10. [Testing](#testing)
11. [Design decisions](#design-decisions)

---

## What's inside

| Phase (from brief) | Implementation |
|---|---|
| **1. Market intelligence** — index sentiment, sector extraction, news classification | `packages/core/analytics/market.py`, `news.py` |
| **2. Portfolio analytics** — P&L, allocation, concentration risk | `packages/core/analytics/portfolio.py` |
| **3. Autonomous reasoning** — causal linking, conflict resolution, prioritization | `packages/agents/advisor.py`, `reasoner.py`, `context.py` |
| **4. Observability & evaluation** — Langfuse, self-eval | `packages/agents/tracing.py`, `evaluator.py` |

---

## Architecture

A pragmatic monorepo: two deployable apps, two shared libraries, one data store.

```
vamos/
├── apps/
│   ├── api/                       # FastAPI backend
│   │   └── src/vamos_api/
│   │       ├── main.py            # app factory + uvicorn entry
│   │       ├── cli.py             # terminal demo (script loop)
│   │       ├── core/              # config, logging, DI
│   │       └── routes/            # /portfolios, /market, /news, /advisor
│   └── web/                       # Next.js 15 dashboard
│       ├── app/                   # App Router pages (RSC + client)
│       ├── components/            # MarketHeader, BriefingPanel, …
│       └── lib/api.ts             # typed API client
├── packages/
│   ├── core/                      # pure domain — NO I/O outside DataLoader
│   │   └── src/vamos_core/
│   │       ├── schemas/           # Pydantic models (Market, News, Portfolio, Sector)
│   │       ├── analytics/         # market trend, portfolio P&L, news ranking
│   │       └── data_loader.py
│   └── agents/                    # reasoning — depends on core + Anthropic SDK
│       └── src/vamos_agents/
│           ├── advisor.py         # orchestrator
│           ├── context.py         # prioritization layer
│           ├── reasoner.py        # Claude call w/ prompt caching
│           ├── evaluator.py       # hybrid self-eval (LLM + rules)
│           ├── tracing.py         # Langfuse (no-op if unconfigured)
│           ├── prompts/           # system prompts, versioned here
│           ├── tools/             # tool-use JSON schemas
│           └── schemas.py         # output contract
├── data/                          # mock JSON + DATASET.md
├── scripts/                       # setup.sh, dev.sh
├── docker-compose.yml
├── pyproject.toml                 # uv workspace root
└── pnpm-workspace.yaml
```

### Data flow — end to end

```
                         ┌────────────────────────────────┐
                         │        DataLoader              │
                         │  (Pydantic-validated mock)     │
                         └────────────┬───────────────────┘
                                      ▼
   ┌──────────────────────┐   ┌──────────────────────┐   ┌────────────────────┐
   │ compute_market_trend │   │ compute_portfolio_   │   │ rank_news_for_     │
   │                      │   │   analytics          │   │   portfolio        │
   │ • index sentiment    │   │ • P&L day + overall  │   │ • scope × impact × │
   │ • sector ranking     │   │ • sector allocation  │   │   exposure         │
   │                      │   │ • concentration risk │   │ • drops irrelevant │
   └──────────┬───────────┘   └──────────┬───────────┘   └──────────┬─────────┘
              │                          │                          │
              └──────────────────────────┼──────────────────────────┘
                                         ▼
                         ┌───────────────────────────────┐
                         │     build_context()           │
                         │  compact, prioritized JSON    │
                         └────────────┬──────────────────┘
                                      ▼
                         ┌───────────────────────────────┐
                         │    Reasoner (Claude)          │
                         │ • prompt cache on system      │
                         │ • forced tool_use for struct  │
                         │   AdvisorBriefing output      │
                         └────────────┬──────────────────┘
                                      ▼
                         ┌───────────────────────────────┐
                         │    Evaluator (Haiku + rules)  │
                         │ • LLM judge (0.6 weight)      │
                         │ • rules (0.4 weight)          │
                         └────────────┬──────────────────┘
                                      ▼
                         ┌───────────────────────────────┐
                         │    AdvisorBriefing            │
                         │  headline · summary ·         │
                         │  causal_chains · conflicts ·  │
                         │  key_insights · confidence ·  │
                         │  evaluation · trace_id        │
                         └───────────────────────────────┘
```

Every step is traced through **Langfuse** with a single trace-id.

---

## Quickstart

### Prerequisites

- Python 3.11+
- [uv](https://github.com/astral-sh/uv) (or plain pip)
- Node 20+ and pnpm (or npm) for the web app
- An `ANTHROPIC_API_KEY`

### 1. Setup

```bash
./scripts/setup.sh
cp .env.example .env            # then fill in ANTHROPIC_API_KEY
```

### 2. CLI (fastest way to see it work)

```bash
source .venv/bin/activate

vamos-cli list                       # available portfolios
vamos-cli analytics PORTFOLIO_002    # deterministic analytics, no LLM
vamos-cli brief PORTFOLIO_002        # full agent briefing
vamos-cli brief --all                # brief every portfolio
vamos-cli brief PORTFOLIO_002 --json # raw JSON for piping
```

### 3. API + Web

```bash
./scripts/dev.sh
# API → http://localhost:8247   (docs at /docs)
# Web → http://localhost:4247
```

### 4. Docker (everything in one command)

```bash
docker compose up --build
# → http://localhost:4247
```

---

## How the agent works

### Phase 1 — Market intelligence

`compute_market_trend` aggregates NIFTY50 + SENSEX into an **overall
sentiment** (BULLISH/BEARISH/NEUTRAL), counts advancing vs declining
sectors, and surfaces the three biggest gaining/losing sectors with a
one-line rationale. It is a pure function — no LLM.

### Phase 2 — Portfolio analytics

`compute_portfolio_analytics` recomputes P&L, sector allocation, asset
split, and concentration risk **from raw holdings**. Thresholds:

- Single-sector > 40% → `CRITICAL` if ≥ 60%, else `HIGH`
- Single-stock > 20% → `HIGH`

The mutual-fund bucket is flagged separately so "62% in diversified MFs"
doesn't trigger a bogus concentration alert.

### Phase 3 — Autonomous reasoning

Before the LLM sees anything, the **prioritization layer** runs:

- `rank_news_for_portfolio` scores each article by
  `scope × impact × (1 + portfolio_exposure%)`. Articles about sectors
  you hold 30% in are prioritized over random market-wide noise.
- `build_context` flattens everything into a compact JSON payload, with
  holdings sorted by weight (so the model sees the big positions first).

The reasoner then makes **one Claude call** with:

- A **cached system prompt** — large, stable, sets the "causal chains, no
  data dumps, flag conflicts, honour concentration" rules.
- A `produce_briefing` **forced tool-use** — the model must emit exactly
  one structured `AdvisorBriefing`, so we get JSON-schema-validated
  output with no parsing hacks.

### Phase 4 — Self-evaluation

`Evaluator` runs **two parallel grading passes** and blends them:

1. **LLM judge** (Claude Haiku) scores on groundedness, causal depth,
   prioritization, conflict handling, concentration coverage.
2. **Rule checks** — deterministic gates:
   - Every cited stock is actually in the portfolio.
   - Concentration risk surfaced when it exists.
   - Expected conflicts (positive news + negative price, or vice versa)
     are flagged.

Final score is `0.6 × LLM + 0.4 × rules`. If the LLM judge is
unavailable, rules-only is returned with `method="rules_only"`.

---

## API reference

`http://localhost:8247` — full OpenAPI at `/docs`.

| Method | Path | What it returns |
|---|---|---|
| `GET` | `/health` | liveness + data dir sanity |
| `GET` | `/market/trend` | aggregated sentiment (pure analytics) |
| `GET` | `/market/snapshot` | raw market data |
| `GET` | `/market/sectors` | sectors ranked by move magnitude |
| `GET` | `/market/stocks/{symbol}` | stock + related news |
| `GET` | `/news?scope=&impact=` | filtered news feed |
| `GET` | `/news/sectors/{sector}` | news mentioning a sector |
| `GET` | `/news/stocks/{symbol}` | news mentioning a stock |
| `GET` | `/portfolios` | list w/ summary stats |
| `GET` | `/portfolios/{id}` | full holdings |
| `GET` | `/portfolios/{id}/analytics` | recomputed P&L + risk |
| `GET` | `/portfolios/{id}/relevant-news?top_k=` | ranked news for this portfolio |
| `POST` | `/advisor/brief` | **full agent briefing** (blocking JSON) |
| `POST` | `/advisor/brief/stream` | **streamed briefing** via Server-Sent Events |

### `POST /advisor/brief/stream`

Server-Sent Events. Event sequence:

| Event | When | Payload |
|---|---|---|
| `analytics` | t=0 (instant) | market trend + portfolio analytics |
| `context` | t≈0 | top-5 ranked news + holdings preview |
| `start` | first byte from LLM | trace_id |
| `delta` | every token | partial tool-input JSON fragment |
| `briefing` | LLM finished | full structured `AdvisorBriefing` |
| `evaluation` | grading done | `EvaluationResult` |
| `done` | end | `latency_ms`, `usage`, `trace_id` |
| `error` | anywhere | error + HTTP code hint |

The UI renders `analytics` immediately (~30ms), shows the causal briefing as it streams (first token ~1-1.5s), and appends self-eval after the main content is visible. The blocking endpoint below is still available for integrations that want a single JSON blob.

### `POST /advisor/brief`

```json
{ "portfolio_id": "PORTFOLIO_002", "top_news": 8, "skip_evaluation": false }
```

Response (trimmed):

```json
{
  "portfolio_id": "PORTFOLIO_002",
  "user_name": "Priya Patel",
  "as_of_date": "2026-04-21",
  "headline": "RBI's hawkish tone turned your banking concentration against you.",
  "summary": "Banks sold off on persistent rate-hike risk ...",
  "causal_chains": [
    {
      "trigger": "RBI signalled hawkish stance at today's MPC",
      "sector": "BANKING",
      "sector_impact_pct": -2.45,
      "stocks": ["HDFCBANK", "ICICIBANK", "SBIN"],
      "portfolio_impact_pct": -1.95,
      "narrative": "RBI hawkishness → banking -2.45% → your 72% bank exposure → -1.95% portfolio drag."
    }
  ],
  "key_insights": [
    {
      "title": "Critical concentration risk",
      "detail": "71.9% of your portfolio sits in banking — a single rate shock moves the whole book.",
      "severity": "CRITICAL"
    }
  ],
  "conflicts": [
    {
      "stock_or_sector": "BAJFINANCE",
      "news_signal": "Strong asset quality and guidance beat",
      "price_signal": "Stock down -2.01% on the day",
      "explanation": "Sector-wide risk-off sentiment dominated the positive issuer-specific news."
    }
  ],
  "confidence": 0.87,
  "confidence_rationale": "Strong news signal, direct exposure mapping, no ambiguous data.",
  "evaluation": {
    "score": 0.83,
    "grounded": true,
    "causal_depth": "DEEP",
    "method": "hybrid"
  },
  "latency_ms": 4120,
  "trace_id": "9a3b…"
}
```

---

## CLI reference

```
vamos-cli list
vamos-cli analytics <PORTFOLIO_ID>
vamos-cli brief <PORTFOLIO_ID> [--json]
vamos-cli brief --all [--json]
```

---

## Observability

- **Langfuse tracing** — `Tracer` wraps every pipeline stage. Each
  `advisor.brief` call creates one trace with child spans for
  `reasoning` and `evaluation`; LLM generations log model, prompt,
  response, and token usage including **cache reads** (so you can see
  prompt-cache hit rate).
- **Zero-config safety** — if `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY`
  aren't set, tracing silently becomes a no-op. Local dev never breaks.
- **Per-response metadata** — the API response carries `trace_id`,
  `latency_ms`, and `token_usage` so you can correlate from client logs.

---

## Evaluation layer

The `EvaluationResult` attached to each briefing tells you how much to
trust the agent. Scoring:

```
final = 0.6 × llm_judge_score + 0.4 × rule_pass_rate
```

Rule checks (all return 0.0 or 1.0):

1. `causal_chains` is non-empty
2. Cited stocks exist in portfolio
3. Confidence score is in [0, 1]
4. Concentration risk surfaced when present
5. Conflicting signals flagged when news sentiment disagrees with
   day price action by ≥ 1 pp

---

## Deployment

### Docker Compose

```bash
docker compose up --build
```

The API container mounts `./data` read-only. The web container is built
as a Next.js standalone bundle (no dev server in prod), and waits for
API's `/health` before starting.

### Kubernetes (quick pointers)

- API: stateless deployment, scale horizontally. Cache responses at the
  gateway; briefings are relatively expensive (~4-6s, ~3-5k tokens).
- Web: use `output: 'standalone'` bundle — the Dockerfile already does.
- Secrets: `ANTHROPIC_API_KEY`, `LANGFUSE_*` via sealed-secrets / KV.

---

## Testing

```bash
.venv/bin/python -m pytest -v
```

Tests cover:

- Data loader round-trips for all three portfolios
- Market trend aggregation
- Portfolio P&L matches the mock dataset's ground truth
- Concentration detection (positive + negative cases)
- News ranking prioritizes held stocks
- Evaluator rules catch missing concentration warnings, hallucinated
  stocks, and accept well-formed briefings

These run **without an API key** — the LLM layer is exercised
separately when `ANTHROPIC_API_KEY` is set.

---

## Design decisions

**Why a monorepo?** Three deployables share one data contract. Splitting
into multiple repos would mean publishing Pydantic models as a package,
a versioning burden for a challenge-sized project. The workspace lets
the web client and Python reasoner stay in lockstep.

**Why separate `core` and `agents`?** `core` is pure analytics — no
external I/O except reading the JSON data. `agents` is the only place
the Anthropic SDK or Langfuse appears. This means:

- Unit tests on `core` are instant and deterministic.
- You can swap LLM providers by replacing one package.
- The FastAPI routes don't accidentally grow LLM coupling.

**Why tool use for structured output?** More reliable than JSON mode,
gives free schema validation on the model side, and Claude treats tools
as first-class so it rarely omits required fields.

**Why prompt caching?** The system prompt is ~1.5kB and identical on
every call — cache hits reduce effective input tokens by >80% and
latency noticeably. `cache_read_input_tokens` is surfaced in the
response so you can verify.

**Why Haiku for evaluation?** A fast, cheap model is plenty for
grading 1-2kB of briefing JSON, and keeping evaluation < 1s means we
can run it on every briefing instead of sampling.

**Why ranked news instead of sending everything?** Context engineering.
A reasoner given 25 articles performs worse than one given 6 relevant
articles. The ranking also creates a natural audit trail — every
article carries a `why_relevant` string.
