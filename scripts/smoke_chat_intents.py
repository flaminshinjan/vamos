"""Smoke-test the chat agent against one sample from each intent bucket.

Picks the first prompt from each of the 12 categories the user listed,
streams a turn through chat_stream, and reports:
  - which tool(s) Claude picked
  - first ~150 chars of any text reply
  - any cards emitted (kind only)
  - whether a `note` card surfaced (used for graceful failures + text tools)

Exits non-zero if any turn errored. Skips network-heavy SerpApi tools
unless --serp is passed.
"""

from __future__ import annotations

import argparse
import os
import sys
from collections import defaultdict
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / "packages/agents/src"))
sys.path.insert(0, str(REPO / "packages/core/src"))

# Load .env if present so ANTHROPIC_API_KEY etc. resolve.
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

PROMPTS = [
    # Each: (category, prompt, expected_tool_substring).
    # "market" matches both lookup_market (live) and show_market_snapshot (fallback).
    ("0/market casual",  "what's happening in the market today?",       "market"),
    # "why market down" is ambiguous — can route to a market tool OR news (causes).
    ("0/market lazy",    "why market down",                              None),
    ("0/market emotion", "why is everything red today",                  None),  # could be market or holdings
    ("1/portfolio impact", "what's happening to my money today?",        "explain_portfolio_move"),
    ("2/loss",            "why am i in loss today",                      "explain_portfolio_move"),
    ("3/gain",            "why am i making money today",                 "explain_portfolio_move"),
    ("4/single stock",    "why is INFY moving",                          "diagnose_stock"),
    ("5/mismatch",        "market is up but i'm not—why?",               "compare_portfolio_to_market"),
    ("6/action",          "what should i do now",                         None),
    ("7/risk",            "am i too exposed somewhere",                  "show_concentration_risk"),
    ("8/diversification", "am i too concentrated",                       "show_concentration_risk"),
    ("9/mutual fund",     "why is my mf not moving much",                "show_my_mutual_funds"),
    ("10/time horizon",   "should i care about this",                    None),
    ("11/prioritization", "what's the main thing i should know",         None),
    ("12/halluc trigger", "which of my stocks had news today?",          "show_classified_news"),
    ("12/halluc trigger", "did any of my companies report results?",     None),
    ("greeting",          "hello",                                        None),
]


def run_one(category: str, prompt: str, expected: str | None, *, loader, advisor) -> dict:
    tools_picked: list[str] = []
    cards: list[str] = []
    note_texts: list[str] = []
    text_buf: list[str] = []
    errored = False
    error_msg = ""

    for ev in chat_stream(
        loader=loader,
        portfolio_id="PORTFOLIO_001",
        user_message=prompt,
        history=[],
        advisor=advisor,
    ):
        e = ev["event"]
        d = ev["data"]
        if e == "text_delta":
            text_buf.append(d.get("text", ""))
        elif e == "tool_call":
            if d.get("status") == "active" and d.get("name"):
                tools_picked.append(d["name"])
        elif e == "card":
            kind = d.get("kind", "?")
            cards.append(kind)
            if kind == "note":
                note_texts.append(d.get("text", "")[:200])
        elif e == "error":
            errored = True
            error_msg = d.get("error", "")
        elif e == "done":
            break
        elif e == "briefing_started":
            cards.append("briefing(streaming)")
            break  # don't actually run the heavy briefing pipeline in smoke

    text = "".join(text_buf).strip()
    matched = (
        expected is None
        or any(expected in t for t in tools_picked)
        or any(expected in c for c in cards)
    )
    return {
        "category": category,
        "prompt": prompt,
        "expected": expected,
        "tools": tools_picked,
        "cards": cards,
        "text_preview": text[:150],
        "note_preview": note_texts[0] if note_texts else "",
        "matched": matched,
        "errored": errored,
        "error": error_msg,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--serp", action="store_true",
                    help="Include SerpApi-backed prompts (single stock, sector). "
                         "Off by default — those make real network calls.")
    args = ap.parse_args()

    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("ANTHROPIC_API_KEY not set", file=sys.stderr)
        return 1

    if not args.serp:
        # Drop the single-stock prompt that hits SerpApi
        prompts = [p for p in PROMPTS if p[2] != "diagnose_stock"]
    else:
        prompts = list(PROMPTS)

    loader = DataLoader(str(REPO / "data"))
    advisor = AdvisorAgent(loader=loader)

    print(f"Running {len(prompts)} prompts against PORTFOLIO_001\n")
    by_cat: dict[str, list[dict]] = defaultdict(list)
    misses: list[dict] = []
    errors: list[dict] = []

    for cat, prompt, expected in prompts:
        try:
            r = run_one(cat, prompt, expected, loader=loader, advisor=advisor)
        except Exception as e:
            r = {"category": cat, "prompt": prompt, "errored": True, "error": str(e),
                 "tools": [], "cards": [], "text_preview": "", "note_preview": "",
                 "matched": False, "expected": expected}
        by_cat[cat].append(r)
        status = "OK " if r["matched"] and not r["errored"] else "MISS"
        if r["errored"]:
            status = "ERR "
            errors.append(r)
        if not r["matched"] and not r["errored"]:
            misses.append(r)
        tool_str = ",".join(r["tools"]) or "(no tool)"
        card_str = ",".join(r["cards"]) or "(no card)"
        print(f"  [{status}] {cat:24s} → tools={tool_str:50s} cards={card_str}")
        if r["text_preview"]:
            print(f"         text: {r['text_preview']}")
        if r["note_preview"]:
            print(f"         note: {r['note_preview']}")
        if r["errored"]:
            print(f"         ERROR: {r['error']}")

    print()
    print(f"Total: {len(prompts)}  Matched: {len(prompts) - len(misses) - len(errors)}  "
          f"Misroutes: {len(misses)}  Errors: {len(errors)}")
    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
