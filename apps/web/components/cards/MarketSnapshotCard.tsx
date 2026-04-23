"use client";

import type { MarketTrend } from "@/lib/api";

export function MarketSnapshotCard({ trend }: { trend: MarketTrend }) {
  const gainers = trend.top_gaining_sectors;
  const losers = trend.top_losing_sectors;
  const indices = Object.entries(trend.index_snapshot);

  return (
    <div className="card fade-up">
      <div className="card-head">
        <div className="card-title">
          <span
            className={`dot ${
              trend.overall_sentiment === "BEARISH"
                ? "neg"
                : trend.overall_sentiment === "BULLISH"
                  ? "pos"
                  : ""
            }`}
          />
          Market snapshot · {trend.overall_sentiment}
        </div>
        <div className="card-sub">NSE · Close</div>
      </div>
      <div className="card-body">
        <p
          style={{
            margin: "0 0 16px",
            fontSize: 13.5,
            color: "var(--ink-2)",
            lineHeight: 1.55,
          }}
        >
          {trend.rationale}
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${Math.min(indices.length, 5)}, 1fr)`,
            gap: 12,
            paddingBottom: 16,
            borderBottom: "1px dashed var(--line)",
          }}
        >
          {indices.slice(0, 5).map(([name, change]) => (
            <div key={name}>
              <div
                className="mono"
                style={{
                  fontSize: 10,
                  color: "var(--ink-3)",
                  letterSpacing: "0.08em",
                  marginBottom: 4,
                }}
              >
                {name}
              </div>
              <div
                className="serif"
                style={{
                  fontSize: 20,
                  letterSpacing: "-0.02em",
                  color: change >= 0 ? "var(--pos)" : "var(--neg)",
                }}
              >
                {change >= 0 ? "+" : "−"}
                {Math.abs(change).toFixed(2)}
                <span style={{ fontSize: 12 }}>%</span>
              </div>
            </div>
          ))}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 24,
            paddingTop: 16,
          }}
        >
          <div>
            <div className="eyebrow" style={{ marginBottom: 10 }}>
              Sectors up
            </div>
            {gainers.map(([name, change]) => (
              <div
                key={name}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12.5,
                  padding: "4px 0",
                }}
              >
                <span>{sectorLabel(name)}</span>
                <span className="mono tnum pos-fg">
                  +{change.toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
          <div>
            <div className="eyebrow" style={{ marginBottom: 10 }}>
              Sectors down
            </div>
            {losers.map(([name, change]) => (
              <div
                key={name}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12.5,
                  padding: "4px 0",
                }}
              >
                <span>{sectorLabel(name)}</span>
                <span className="mono tnum neg-fg">
                  {change.toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function sectorLabel(s: string): string {
  return s
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
