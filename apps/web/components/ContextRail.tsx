"use client";

import type {
  Portfolio,
  PortfolioAnalytics,
  RelevantNews,
} from "@/lib/api";
import { SECTOR_COLORS, formatINR } from "@/lib/format";

export function ContextRail({
  portfolio,
  analytics,
  news,
}: {
  portfolio: Portfolio;
  analytics: PortfolioAnalytics;
  news: RelevantNews[];
}) {
  // Prefer non-MF-bucket sectors first; keep MF as a catch-all at the end
  const sectors = Object.entries(analytics.sector_allocation)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([name, weight]) => ({ name, weight }));

  const topHoldings = [...portfolio.holdings.stocks]
    .sort((a, b) => b.weight_in_portfolio - a.weight_in_portfolio)
    .slice(0, 6);

  const dayPL = analytics.day_summary.day_change_absolute;
  const dayPct = analytics.day_summary.day_change_percent;

  return (
    <aside className="ctx">
      <div className="ctx-section">
        <h4>Active portfolio</h4>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>
          {portfolio.user_name}
        </div>
        <div style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 16 }}>
          {portfolio.portfolio_type.replace(/_/g, " ").toLowerCase()} ·{" "}
          {portfolio.holdings.stocks.length} stocks ·{" "}
          {portfolio.holdings.mutual_funds.length} funds
        </div>
        <div className="kpi-stack">
          <div className="kpi">
            <span className="kpi-label">Value</span>
            <span className="kpi-val">{formatINR(analytics.current_value)}</span>
          </div>
          <div className="kpi">
            <span className="kpi-label">Day P&amp;L</span>
            <span
              className="kpi-val sm"
              style={{ color: dayPL >= 0 ? "var(--pos)" : "var(--neg)" }}
            >
              {dayPL >= 0 ? "+" : "−"}
              {formatINR(Math.abs(dayPL))}
              <span
                className="mono"
                style={{ fontSize: 11, marginLeft: 6, opacity: 0.8 }}
              >
                {dayPct >= 0 ? "+" : "−"}
                {Math.abs(dayPct).toFixed(2)}%
              </span>
            </span>
          </div>
          <div className="kpi">
            <span className="kpi-label">Overall</span>
            <span
              className="kpi-val sm pos-fg"
              style={{
                color:
                  analytics.overall_gain_loss >= 0
                    ? "var(--pos)"
                    : "var(--neg)",
              }}
            >
              {analytics.overall_gain_loss >= 0 ? "+" : "−"}
              {formatINR(Math.abs(analytics.overall_gain_loss))}
              <span
                className="mono"
                style={{ fontSize: 11, marginLeft: 6, opacity: 0.8 }}
              >
                {analytics.overall_gain_loss_percent >= 0 ? "+" : "−"}
                {Math.abs(analytics.overall_gain_loss_percent).toFixed(2)}%
              </span>
            </span>
          </div>
        </div>
      </div>

      <div className="ctx-section">
        <h4>Sector allocation</h4>
        <div className="sector-bar">
          {sectors.map((s, i) => (
            <div
              key={s.name}
              style={{
                flex: s.weight,
                background: SECTOR_COLORS[i] || "var(--line)",
              }}
              title={`${s.name} ${s.weight}%`}
            />
          ))}
        </div>
        {sectors.map((s, i) => (
          <div
            key={s.name}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 12,
              padding: "5px 0",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: SECTOR_COLORS[i] || "var(--line)",
                }}
              />
              <span
                style={{
                  color: s.weight > 40 ? "var(--neg)" : "var(--ink-2)",
                  fontWeight: s.weight > 40 ? 500 : 400,
                }}
              >
                {sectorLabel(s.name)}
              </span>
              {s.weight > 40 && s.name !== "DIVERSIFIED_MF" && (
                <span
                  className="pill warn"
                  style={{ fontSize: 9, padding: "1px 5px" }}
                >
                  concentrated
                </span>
              )}
            </span>
            <span
              className="mono tnum"
              style={{ color: "var(--ink-3)", fontSize: 11 }}
            >
              {s.weight.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>

      <div className="ctx-section">
        <h4>Top holdings</h4>
        {topHoldings.map((h) => (
          <div key={h.symbol} className="hold-row">
            <div>
              <div className="hold-sym">{h.symbol}</div>
              <div className="hold-sec">
                {sectorLabel(h.sector)} · {h.weight_in_portfolio.toFixed(1)}%
              </div>
            </div>
            <div
              className="hold-delta"
              style={{
                color:
                  h.day_change_percent >= 0 ? "var(--pos)" : "var(--neg)",
              }}
            >
              {h.day_change_percent >= 0 ? "+" : "−"}
              {Math.abs(h.day_change_percent).toFixed(2)}%
            </div>
            <div className="hold-val">
              {formatINR(h.current_value).replace("₹", "")}
            </div>
          </div>
        ))}
      </div>

      <div className="ctx-section">
        <h4>Latest signals</h4>
        {news.slice(0, 3).map((n) => (
          <div
            key={n.article.id}
            style={{
              fontSize: 12,
              lineHeight: 1.45,
              padding: "8px 0",
              borderBottom: "1px dashed var(--line)",
            }}
          >
            <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
              <span
                className={`pill ${
                  n.article.sentiment === "POSITIVE"
                    ? "pos"
                    : n.article.sentiment === "NEGATIVE"
                      ? "neg"
                      : ""
                }`}
                style={{ fontSize: 9, padding: "1px 6px" }}
              >
                {n.article.sentiment.toLowerCase()}
              </span>
              <span style={{ fontSize: 10, color: "var(--ink-3)" }}>
                {n.article.source}
              </span>
            </div>
            <div style={{ color: "var(--ink-2)" }}>{n.article.headline}</div>
          </div>
        ))}
      </div>
    </aside>
  );
}

function sectorLabel(s: string): string {
  return s
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
