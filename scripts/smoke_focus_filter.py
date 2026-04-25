"""Verify show_classified_news + show_my_holdings_performance honor `focus`
based on user framing (negative-only when user asks about pain, etc.).
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


def run(loader, advisor, message: str) -> dict:
    tool_inputs = []
    cards = []
    last_card_data = {}
    text = []
    for ev in chat_stream(
        loader=loader, portfolio_id="PORTFOLIO_001",
        user_message=message, history=[], advisor=advisor,
    ):
        e, d = ev["event"], ev["data"]
        if e == "text_delta":
            text.append(d.get("text", ""))
        elif e == "tool_call" and d.get("status") == "active" and d.get("name"):
            tool_inputs.append((d["name"], None))
        elif e == "card":
            kind = d.get("kind")
            cards.append(kind)
            last_card_data = d
        elif e == "done":
            break
    return {"text": "".join(text).strip(), "cards": cards, "card_data": last_card_data}


CASES = [
    ("show me the negative news",                 "news",     "negative"),
    ("what's hurting my portfolio",                "any",      "negative_or_losers"),
    ("which positions are dragging me down",       "holdings", "losers"),
    ("what's working for me today",                "any",      "positive_or_gainers"),
    ("show me today's headlines",                  "news",     "all"),
    ("how are my stocks doing",                    "holdings", "all"),
]


def main():
    loader = DataLoader(str(REPO / "data"))
    advisor = AdvisorAgent(loader=loader)
    failed = 0
    for prompt, _, expected in CASES:
        r = run(loader, advisor, prompt)
        kind = r["cards"][-1] if r["cards"] else "(none)"
        focus = r["card_data"].get("focus", "?")
        lead = r["card_data"].get("lead", "")
        items_count = len(
            r["card_data"].get("news") or r["card_data"].get("holdings") or []
        )
        # Validate
        ok = False
        if expected == "negative":
            ok = kind == "news" and focus == "negative"
        elif expected == "negative_or_losers":
            ok = (kind == "news" and focus == "negative") or (
                kind == "holdings" and focus == "losers"
            )
        elif expected == "losers":
            ok = kind == "holdings" and focus == "losers"
        elif expected == "positive_or_gainers":
            ok = (kind == "news" and focus == "positive") or (
                kind == "holdings" and focus == "gainers"
            )
        elif expected == "all":
            ok = focus == "all"
        if not ok:
            failed += 1
        print(f"[{ 'OK ' if ok else 'FAIL' }] {prompt}")
        print(f"       card={kind}  focus={focus}  items={items_count}")
        if lead:
            print(f"       lead: {lead}")
        print()
    print(f"=== {failed} failure(s) ===")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
