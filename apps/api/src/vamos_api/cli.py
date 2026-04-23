"""CLI entry point — run the agent without the web stack.

Usage:
    vamos-cli                  # list portfolios
    vamos-cli brief PORTFOLIO_002
    vamos-cli brief --all
    vamos-cli analytics PORTFOLIO_001
"""

from __future__ import annotations

import argparse
import json
import sys

from dotenv import load_dotenv

load_dotenv()

from vamos_agents.advisor import AdvisorAgent  # noqa: E402
from vamos_agents.reasoner import ReasonerError  # noqa: E402
from vamos_agents.settings import get_settings  # noqa: E402
from vamos_core import DataLoader  # noqa: E402
from vamos_core.analytics import (  # noqa: E402
    compute_market_trend,
    compute_portfolio_analytics,
    rank_news_for_portfolio,
)


# ANSI — skip colors if not a TTY
_USE_COLOR = sys.stdout.isatty()


def _c(code: str, text: str) -> str:
    if not _USE_COLOR:
        return text
    return f"\033[{code}m{text}\033[0m"


BOLD = lambda s: _c("1", s)  # noqa: E731
DIM = lambda s: _c("2", s)  # noqa: E731
RED = lambda s: _c("31", s)  # noqa: E731
GREEN = lambda s: _c("32", s)  # noqa: E731
YELLOW = lambda s: _c("33", s)  # noqa: E731
BLUE = lambda s: _c("34", s)  # noqa: E731
MAGENTA = lambda s: _c("35", s)  # noqa: E731
CYAN = lambda s: _c("36", s)  # noqa: E731


def _hr(title: str = "") -> None:
    bar = "─" * 72
    if title:
        print(f"\n{DIM(bar)}\n {BOLD(title)}\n{DIM(bar)}")
    else:
        print(DIM(bar))


def _severity_color(severity: str) -> str:
    return {
        "CRITICAL": RED(f"[{severity}]"),
        "WARN": YELLOW(f"[{severity}]"),
        "INFO": BLUE(f"[{severity}]"),
    }.get(severity, f"[{severity}]")


def cmd_list(loader: DataLoader) -> int:
    _hr("Portfolios")
    for pid in loader.list_portfolio_ids():
        p = loader.get_portfolio(pid)
        print(
            f" {BOLD(pid)}  {p.user_name:<22} "
            f"{CYAN(p.portfolio_type.value):<32}  ₹{p.current_value:,.0f}"
        )
    return 0


def cmd_analytics(loader: DataLoader, portfolio_id: str) -> int:
    p = loader.get_portfolio(portfolio_id)
    a = compute_portfolio_analytics(p)
    trend = compute_market_trend(loader.market_snapshot)
    ranked = rank_news_for_portfolio(loader.news, p, top_k=5)

    _hr(f"{p.user_name} — {portfolio_id}")
    color = RED if a.day_summary.day_change_percent < 0 else GREEN
    print(
        f" Value:   ₹{a.current_value:,.0f}  "
        f"Day: {color(f'{a.day_summary.day_change_absolute:+,.0f} ({a.day_summary.day_change_percent:+.2f}%)')}"
    )
    print(
        f" Market:  {trend.overall_sentiment.value}  "
        f"({trend.avg_broad_change:+.2f}% broad avg)"
    )
    print(f" Concentration risk: {'YES' if a.concentration_risk else 'no'}")
    for al in a.alerts:
        print(f"   {_severity_color(al.level)} {al.message}")
    print(f"\n {BOLD('Top holdings:')}")
    for h in sorted(p.holdings.stocks, key=lambda x: x.weight_in_portfolio, reverse=True)[:5]:
        c = RED if h.day_change_percent < 0 else GREEN
        print(
            f"   {h.symbol:<12} {h.weight_in_portfolio:>5.1f}%  "
            f"{c(f'{h.day_change_percent:+.2f}%')}  {h.sector}"
        )
    print(f"\n {BOLD('Most relevant news:')}")
    for r in ranked[:5]:
        print(f"   [{r.relevance_score:.2f}] {r.article.headline[:70]}")
    return 0


def _render_briefing(briefing) -> None:
    _hr(f"{briefing.user_name} — {briefing.portfolio_id}  ({briefing.as_of_date})")
    p = briefing.portfolio_analytics
    color = RED if p.day_summary.day_change_percent < 0 else GREEN
    print(
        f" Value: ₹{p.current_value:,.0f}   Day: "
        f"{color(f'{p.day_summary.day_change_absolute:+,.0f} ({p.day_summary.day_change_percent:+.2f}%)')}"
    )
    print(f"\n {BOLD(briefing.headline)}")
    print(f" {briefing.summary}")

    if briefing.causal_chains:
        print(f"\n {BOLD('Causal chains:')}")
        for c in briefing.causal_chains:
            arrow = DIM(" → ")
            print(
                f"  • {c.trigger}{arrow}{c.sector} ({c.sector_impact_pct:+.2f}%)"
                f"{arrow}{', '.join(c.stocks) or '—'}"
                f"{arrow}portfolio {c.portfolio_impact_pct:+.2f}%"
            )
            print(f"    {DIM(c.narrative)}")

    if briefing.key_insights:
        print(f"\n {BOLD('Key insights:')}")
        for i in briefing.key_insights:
            print(f"  {_severity_color(i.severity)} {BOLD(i.title)}")
            print(f"      {i.detail}")

    if briefing.conflicts:
        print(f"\n {BOLD('Conflicting signals:')}")
        for c in briefing.conflicts:
            print(f"  ⚠  {BOLD(c.stock_or_sector)}")
            print(f"     news: {c.news_signal}")
            print(f"     price: {c.price_signal}")
            print(f"     {DIM('→ ' + c.explanation)}")

    if briefing.recommendations:
        print(f"\n {BOLD('Recommendations:')}")
        for r in briefing.recommendations:
            print(f"  • {r}")

    conf_color = GREEN if briefing.confidence >= 0.75 else YELLOW if briefing.confidence >= 0.5 else RED
    print(f"\n {BOLD('Confidence:')} {conf_color(f'{briefing.confidence:.2f}')}  {DIM(briefing.confidence_rationale)}")

    if briefing.evaluation:
        e = briefing.evaluation
        c = GREEN if e.score >= 0.75 else YELLOW if e.score >= 0.5 else RED
        print(
            f" {BOLD('Self-eval:')} {c(f'{e.score:.2f}')}  "
            f"depth={e.causal_depth}  method={e.method}  grounded={e.grounded}"
        )
        if e.missing_elements:
            print(f" {DIM('  Missing: ' + '; '.join(e.missing_elements[:3]))}")

    meta = []
    if briefing.latency_ms:
        meta.append(f"latency {briefing.latency_ms}ms")
    if briefing.token_usage:
        meta.append(
            f"tokens in={briefing.token_usage.get('input_tokens', 0)} "
            f"out={briefing.token_usage.get('output_tokens', 0)}"
        )
    if briefing.trace_id:
        meta.append(f"trace {briefing.trace_id[:8]}")
    if meta:
        print(f" {DIM(' · '.join(meta))}")


def cmd_brief(loader: DataLoader, portfolio_id: str | None, all_: bool, as_json: bool) -> int:
    settings = get_settings()
    if not settings.anthropic_api_key:
        print(
            RED("ANTHROPIC_API_KEY is not set."),
            "\nExport it or add to .env to run the reasoner.",
            file=sys.stderr,
        )
        return 2
    advisor = AdvisorAgent(loader=loader, settings=settings)
    ids = loader.list_portfolio_ids() if all_ else [portfolio_id]
    exit_code = 0
    for pid in ids:
        try:
            briefing = advisor.brief(pid)
        except ReasonerError as e:
            print(RED(f"Reasoner error for {pid}: {e}"), file=sys.stderr)
            exit_code = 1
            continue
        if as_json:
            print(json.dumps(briefing.model_dump(), indent=2, default=str))
        else:
            _render_briefing(briefing)
    return exit_code


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="vamos", description="Vamos financial advisor CLI")
    sub = parser.add_subparsers(dest="command")

    sub.add_parser("list", help="List available portfolios")

    ap = sub.add_parser("analytics", help="Show deterministic analytics for a portfolio")
    ap.add_argument("portfolio_id")

    bp = sub.add_parser("brief", help="Run the agent and produce a causal briefing")
    grp = bp.add_mutually_exclusive_group(required=True)
    grp.add_argument("portfolio_id", nargs="?")
    grp.add_argument("--all", action="store_true", help="Run for every portfolio")
    bp.add_argument("--json", action="store_true", help="Emit raw JSON instead of pretty output")

    args = parser.parse_args(argv)

    from vamos_api.core.config import get_config

    cfg = get_config()
    loader = DataLoader(cfg.data_dir)

    if args.command in (None, "list"):
        return cmd_list(loader)
    if args.command == "analytics":
        return cmd_analytics(loader, args.portfolio_id)
    if args.command == "brief":
        return cmd_brief(loader, args.portfolio_id, args.all, args.json)
    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
