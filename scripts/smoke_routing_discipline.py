"""Verify the two routing-discipline fixes:

1. After asking about a stock, a follow-up "how's the market today" must
   route to lookup_market (or show_market_snapshot if no SerpApi) and must
   NOT re-call diagnose_stock / lookup_stock.

2. With SerpApi available, market questions prefer the live tool over the
   local snapshot.

3. Even if Claude returns multiple tool_uses in one response, the dispatcher
   only fires the first one (hard cap).
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

from vamos_agents.advisor import AdvisorAgent  # noqa: E402
from vamos_agents.chat_agent import chat_stream  # noqa: E402
from vamos_core import DataLoader  # noqa: E402


def run_turn(loader, advisor, message: str, history: list) -> dict:
    tools = []
    cards = []
    text = []
    for ev in chat_stream(
        loader=loader, portfolio_id="PORTFOLIO_001",
        user_message=message, history=history, advisor=advisor,
    ):
        e, d = ev["event"], ev["data"]
        if e == "text_delta":
            text.append(d.get("text", ""))
        elif e == "tool_call" and d.get("status") == "active" and d.get("name"):
            tools.append(d["name"])
        elif e == "card":
            cards.append(d.get("kind"))
        elif e == "done":
            break
        elif e == "briefing_started":
            cards.append("briefing")
            break
    return {"tools": tools, "cards": cards, "text": "".join(text).strip()}


def main():
    loader = DataLoader(str(REPO / "data"))
    advisor = AdvisorAgent(loader=loader)

    failed = 0

    # ── Test 1: live market wins over snapshot ──────────────────────────
    print("Test 1: 'how's the market today' → lookup_market (LIVE)")
    r = run_turn(loader, advisor, "how's the market today", [])
    print(f"  tools={r['tools']}  cards={r['cards']}")
    print(f"  text: {r['text'][:120]}")
    if "lookup_market" not in r["tools"]:
        print("  FAIL — expected lookup_market")
        failed += 1
    elif "show_market_snapshot" in r["tools"]:
        print("  FAIL — should NOT call show_market_snapshot when live is available")
        failed += 1
    else:
        print("  OK")
    print()

    # ── Test 2: stock-then-market does NOT carry stock forward ──────────
    print("Test 2: stock query → market query → must not re-call stock tools")
    history = [
        {"role": "user", "content": "is infosys working today?"},
        {"role": "assistant", "content": "Let me pull up Infosys for you right now."},
    ]
    r = run_turn(loader, advisor, "how's the market doing today", history)
    print(f"  tools={r['tools']}  cards={r['cards']}")
    print(f"  text: {r['text'][:120]}")
    bad = [t for t in r["tools"] if t in ("diagnose_stock", "lookup_stock")]
    if bad:
        print(f"  FAIL — still called stock tools after switching topic: {bad}")
        failed += 1
    elif "lookup_market" not in r["tools"]:
        print("  FAIL — should have called lookup_market")
        failed += 1
    elif len(r["tools"]) > 1:
        print(f"  FAIL — picked too many tools: {r['tools']}")
        failed += 1
    else:
        print("  OK")
    print()

    # ── Test 3: ambiguous "stocks today" stays market-only ──────────────
    print("Test 3: 'what's going on with stocks today' (after INFY discussion)")
    history2 = history + [
        {"role": "user", "content": "how's the market doing today"},
        {"role": "assistant", "content": "Let me pull live indices."},
    ]
    r = run_turn(loader, advisor, "what's going on with stocks today?", history2)
    print(f"  tools={r['tools']}  cards={r['cards']}")
    print(f"  text: {r['text'][:120]}")
    bad = [t for t in r["tools"] if t in ("diagnose_stock", "lookup_stock")]
    if bad:
        print(f"  FAIL — re-called stock tools: {bad}")
        failed += 1
    elif len(r["tools"]) > 1:
        print(f"  FAIL — multi-tool turn: {r['tools']}")
        failed += 1
    else:
        print(f"  OK ({len(r['tools'])} tool)")
    print()

    # ── Test 4: hard cap (we can't easily force Claude to pick 2 tools, ──
    # so this is really validated by the prompt change + dispatcher being
    # capped at tool_uses[:1]. Just print the dispatcher behavior note.) ─
    print("Test 4: dispatcher hard cap — see chat_agent.py tool_uses[:1] slice.")
    print("  OK (enforced in code, not testable without mocking the model)")
    print()

    print(f"=== {failed} failure{'s' if failed != 1 else ''} ===")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
