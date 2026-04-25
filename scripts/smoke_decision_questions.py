"""Verify decision/advice questions get NO tool + a substantive text reply."""

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
    tools = []
    cards = []
    text = []
    for ev in chat_stream(
        loader=loader, portfolio_id="PORTFOLIO_001",
        user_message=message, history=[], advisor=advisor,
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
    return {"text": "".join(text).strip(), "cards": cards, "tools": tools}


# All of these should produce ZERO tool calls and a thoughtful text reply.
DECISION_PROMPTS = [
    "what should i do now for my portfolio?",
    "should I sell anything?",
    "do I need to take action or chill",
    "what would you do here",
    "should i be doing something today",
    "should I worry about this drop",
    "is this a big deal or not",
    "should I just ignore today",
    "is this temporary or serious",
]


def main():
    loader = DataLoader(str(REPO / "data"))
    advisor = AdvisorAgent(loader=loader)
    failed = 0
    for prompt in DECISION_PROMPTS:
        r = run(loader, advisor, prompt)
        no_tool = len(r["tools"]) == 0
        no_card = len(r["cards"]) == 0
        substantive = len(r["text"]) >= 80  # 3+ sentences worth
        ok = no_tool and no_card and substantive
        if not ok:
            failed += 1
        status = "OK " if ok else "FAIL"
        print(f"[{status}] {prompt}")
        print(f"       tools={r['tools'] or '(none)'}  cards={r['cards'] or '(none)'}  textlen={len(r['text'])}")
        print(f"       text: {r['text'][:200]}")
        print()
    print(f"=== {failed} failure(s) of {len(DECISION_PROMPTS)} ===")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
