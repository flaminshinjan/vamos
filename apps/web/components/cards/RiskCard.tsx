"use client";

import type { PortfolioAnalytics } from "@/lib/api";
import { SECTOR_COLORS } from "@/lib/format";

export function RiskCard({ analytics }: { analytics: PortfolioAnalytics }) {
  const sectors = Object.entries(analytics.sector_allocation)
    .sort(([, a], [, b]) => b - a)
    .map(([name, weight]) => ({ name, weight }));

  const concentrated = analytics.concentration_risk;

  return (
    <div className="card fade-up">
      <div className="card-head">
        <div className="card-title">
          {concentrated ? (
            <>
              <span className="dot warn" /> Concentration risk detected
            </>
          ) : (
            <>
              <span className="dot pos" /> No concentration risk
            </>
          )}
        </div>
        <div className="card-sub">threshold 40%</div>
      </div>
      <div className="card-body">
        <div className="sector-bar" style={{ height: 10, marginBottom: 16 }}>
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
        {sectors.map((s, i) => {
          const isMfBucket = s.name === "DIVERSIFIED_MF";
          const overThreshold = s.weight > 40 && !isMfBucket;
          return (
            <div
              key={s.name}
              style={{
                display: "grid",
                gridTemplateColumns: "150px 1fr 60px",
                gap: 12,
                alignItems: "center",
                padding: "7px 0",
                fontSize: 12.5,
              }}
            >
              <span
                style={{
                  color: overThreshold ? "var(--neg)" : "var(--ink-2)",
                  fontWeight: overThreshold ? 500 : 400,
                }}
              >
                {sectorLabel(s.name)}
              </span>
              <div
                style={{
                  height: 5,
                  background: "var(--bg-sunk)",
                  borderRadius: 3,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${Math.min(100, s.weight * 1.5)}%`,
                    height: "100%",
                    background: overThreshold
                      ? "var(--neg)"
                      : SECTOR_COLORS[i] || "var(--line)",
                  }}
                />
              </div>
              <span
                className="mono tnum"
                style={{ textAlign: "right", color: "var(--ink-3)" }}
              >
                {s.weight.toFixed(1)}%
              </span>
            </div>
          );
        })}

        {analytics.alerts.length > 0 && (
          <div
            style={{
              marginTop: 14,
              paddingTop: 14,
              borderTop: "1px dashed var(--line)",
            }}
          >
            {analytics.alerts.map((a, i) => (
              <div
                key={i}
                style={{
                  fontSize: 12.5,
                  padding: "6px 0",
                  color: "var(--ink-2)",
                  display: "flex",
                  gap: 8,
                }}
              >
                <span
                  className={`pill ${
                    a.level === "CRITICAL" ? "neg" : "warn"
                  }`}
                  style={{ fontSize: 9 }}
                >
                  {a.level}
                </span>
                <span>{a.message}</span>
              </div>
            ))}
          </div>
        )}
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
