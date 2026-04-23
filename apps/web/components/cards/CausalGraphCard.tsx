"use client";

import type { AdvisorBriefing, Portfolio, RelevantNews } from "@/lib/api";

type Node = { id: string; label: string; sent?: "pos" | "neg" | "neu" };

export function CausalGraphCard({
  briefing,
  portfolio,
  topNews,
}: {
  briefing: AdvisorBriefing;
  portfolio: Portfolio;
  topNews: RelevantNews[];
}) {
  // News (top 3 by relevance)
  const news: Node[] = topNews.slice(0, 3).map((n) => ({
    id: n.article.id,
    label: shorten(n.article.headline, 28),
    sent:
      n.article.sentiment === "POSITIVE"
        ? "pos"
        : n.article.sentiment === "NEGATIVE"
          ? "neg"
          : "neu",
  }));

  const sectors: Node[] = dedupe(
    briefing.causal_chains.slice(0, 4).map((c) => ({
      id: c.sector,
      label: sectorLabel(c.sector),
      sent: c.sector_impact_pct >= 0 ? "pos" : "neg",
    })),
  );

  const heldSymbols = new Set(portfolio.holdings.stocks.map((h) => h.symbol));
  const stocks = dedupe(
    briefing.causal_chains.flatMap((c) =>
      c.stocks
        .filter((s) => heldSymbols.has(s))
        .map((s) => {
          const h = portfolio.holdings.stocks.find((x) => x.symbol === s);
          return {
            id: s,
            sector: c.sector,
            day: h?.day_change_percent ?? c.portfolio_impact_pct,
          };
        }),
    ),
  ).slice(0, 6);

  const nsLinks = briefing.causal_chains.slice(0, 4).flatMap((c) =>
    topNews
      .slice(0, 3)
      .filter(
        (n) =>
          n.article.entities.sectors.includes(c.sector) ||
          n.matched_sectors.includes(c.sector),
      )
      .map((n) => [n.article.id, c.sector] as const),
  );

  const ssLinks = stocks.map((s) => [s.sector, s.id] as const);

  // Geometry — more generous margins, portfolio node pulled inside viewport
  const W = 720;
  const H = Math.max(
    360,
    Math.max(news.length, sectors.length, stocks.length) * 48 + 60,
  );
  const cols = [32, 210, 400, 600]; // News, Sector, Stock, Portfolio
  const circleR = 44;

  const yFor = (n: number, i: number) => {
    const gap = (H - 60) / Math.max(1, n);
    return 30 + gap * (i + 0.5);
  };
  const newsY = Object.fromEntries(news.map((n, i) => [n.id, yFor(news.length, i)]));
  const secY = Object.fromEntries(sectors.map((s, i) => [s.id, yFor(sectors.length, i)]));
  const stockY = Object.fromEntries(stocks.map((s, i) => [s.id, yFor(stocks.length, i)]));
  const portY = H / 2;

  const stroke = (s?: "pos" | "neg" | "neu") =>
    s === "pos" ? "#2F6B3F" : s === "neg" ? "#9A3B2C" : "#6E6A62";
  const curve = (x1: number, y1: number, x2: number, y2: number) => {
    const mx = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
  };

  const dayPct = briefing.portfolio_analytics.day_summary.day_change_percent;
  const posColor = "#8FCB9F";
  const negColor = "#EAAC9B";

  return (
    <div className="card fade-up">
      <div className="card-head">
        <div className="card-title">
          <span className="dot accent" /> Causal chain · News → Sector → Stock → You
        </div>
        <div className="card-sub">threshold 0.50</div>
      </div>
      <div className="card-body" style={{ overflow: "hidden" }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: "100%", height: "auto", display: "block" }}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Column headers */}
          {["News", "Sector", "Stock", "Portfolio"].map((l, i) => (
            <text
              key={l}
              x={cols[i]}
              y={14}
              textAnchor={i === 3 ? "middle" : "start"}
              fontSize="9"
              fontFamily="JetBrains Mono"
              fill="var(--ink-4)"
              letterSpacing="1.5"
            >
              {String(i + 1).padStart(2, "0")} · {l.toUpperCase()}
            </text>
          ))}

          {/* News → Sector links */}
          {nsLinks.map(([a, b], i) => {
            const n = news.find((x) => x.id === a);
            if (!n || newsY[a] === undefined || secY[b] === undefined) return null;
            return (
              <path
                key={`ns${i}`}
                d={curve(cols[0] + 156, newsY[a], cols[1] - 4, secY[b])}
                stroke={stroke(n.sent)}
                strokeOpacity="0.45"
                strokeWidth="1.5"
                fill="none"
                strokeDasharray="400"
                strokeDashoffset="400"
                style={{ animation: `draw 0.9s ease forwards ${0.1 + i * 0.1}s` }}
              />
            );
          })}

          {/* Sector → Stock links */}
          {ssLinks.map(([sec, stk], i) => {
            const s = sectors.find((x) => x.id === sec);
            if (!s || secY[sec] === undefined || stockY[stk] === undefined) return null;
            return (
              <path
                key={`ss${i}`}
                d={curve(cols[1] + 138, secY[sec], cols[2] - 4, stockY[stk])}
                stroke={stroke(s.sent)}
                strokeOpacity="0.4"
                strokeWidth="1.3"
                fill="none"
                strokeDasharray="400"
                strokeDashoffset="400"
                style={{ animation: `draw 0.9s ease forwards ${0.4 + i * 0.08}s` }}
              />
            );
          })}

          {/* Stock → Portfolio links */}
          {stocks.map((s, i) => (
            <path
              key={`sp${i}`}
              d={curve(cols[2] + 92, stockY[s.id], cols[3] - circleR - 4, portY)}
              stroke={s.day >= 0 ? "#2F6B3F" : "#9A3B2C"}
              strokeOpacity="0.4"
              strokeWidth="1.1"
              fill="none"
              strokeDasharray="400"
              strokeDashoffset="400"
              style={{ animation: `draw 0.9s ease forwards ${0.7 + i * 0.06}s` }}
            />
          ))}

          {/* News nodes */}
          {news.map((n, i) => (
            <g
              key={n.id}
              style={{ animation: `fadeIn 0.4s ease both ${0.1 + i * 0.08}s` }}
            >
              <rect
                x={cols[0]}
                y={newsY[n.id] - 14}
                width="156"
                height="28"
                rx="4"
                fill="var(--bg-elev)"
                stroke={stroke(n.sent)}
                strokeOpacity="0.4"
              />
              <circle cx={cols[0] + 10} cy={newsY[n.id]} r="2.5" fill={stroke(n.sent)} />
              <text
                x={cols[0] + 20}
                y={newsY[n.id] + 3}
                fontSize="10"
                fill="var(--ink-2)"
              >
                {n.label}
              </text>
            </g>
          ))}

          {/* Sector nodes */}
          {sectors.map((s, i) => (
            <g
              key={s.id}
              style={{ animation: `fadeIn 0.4s ease both ${0.35 + i * 0.08}s` }}
            >
              <rect
                x={cols[1] - 4}
                y={secY[s.id] - 14}
                width="142"
                height="28"
                rx="4"
                fill={s.sent === "pos" ? "var(--pos-soft)" : "var(--neg-soft)"}
                stroke={stroke(s.sent)}
                strokeOpacity="0.55"
              />
              <text
                x={cols[1] + 67}
                y={secY[s.id] + 4}
                fontSize="11.5"
                fill={stroke(s.sent)}
                textAnchor="middle"
                fontWeight="600"
              >
                {s.label}
              </text>
            </g>
          ))}

          {/* Stock nodes */}
          {stocks.map((s, i) => (
            <g
              key={s.id}
              style={{ animation: `fadeIn 0.4s ease both ${0.65 + i * 0.07}s` }}
            >
              <rect
                x={cols[2] - 4}
                y={stockY[s.id] - 14}
                width="96"
                height="28"
                rx="4"
                fill="var(--bg-elev)"
                stroke="var(--line-strong)"
              />
              <text
                x={cols[2] + 4}
                y={stockY[s.id] + 4}
                fontSize="10.5"
                fontFamily="JetBrains Mono"
                fill="var(--ink)"
              >
                {s.id}
              </text>
              <text
                x={cols[2] + 88}
                y={stockY[s.id] + 4}
                fontSize="9.5"
                fontFamily="JetBrains Mono"
                textAnchor="end"
                fill={s.day >= 0 ? "#2F6B3F" : "#9A3B2C"}
              >
                {s.day >= 0 ? "+" : "−"}
                {Math.abs(s.day).toFixed(1)}%
              </text>
            </g>
          ))}

          {/* Portfolio node — circle with centered label + day P&L */}
          <g style={{ animation: "fadeIn 0.5s ease both 1.1s" }}>
            <circle
              cx={cols[3]}
              cy={portY}
              r={circleR}
              fill="var(--ink)"
            />
            <text
              x={cols[3]}
              y={portY - 8}
              textAnchor="middle"
              fontSize="8.5"
              fontFamily="JetBrains Mono"
              letterSpacing="1.8"
              fill="var(--bg)"
              opacity="0.55"
            >
              PORTFOLIO
            </text>
            <text
              x={cols[3]}
              y={portY + 14}
              textAnchor="middle"
              fontSize="18"
              fontFamily="Instrument Serif"
              letterSpacing="-0.01em"
              fill={dayPct >= 0 ? posColor : negColor}
            >
              {dayPct >= 0 ? "+" : "−"}
              {Math.abs(dayPct).toFixed(2)}%
            </text>
          </g>
        </svg>
      </div>
    </div>
  );
}

function shorten(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function sectorLabel(s: string): string {
  return s
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function dedupe<T extends { id: string }>(arr: T[]): T[] {
  const seen = new Set<string>();
  return arr.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)));
}
