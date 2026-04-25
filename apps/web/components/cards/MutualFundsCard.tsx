"use client";

import type { MutualFundsPayload } from "@/lib/api";

export function MutualFundsCard({ payload }: { payload: MutualFundsPayload }) {
  const { summary, funds, weighted_day_change_pct } = payload;
  const dayTone =
    weighted_day_change_pct > 0.05
      ? "var(--pos)"
      : weighted_day_change_pct < -0.05
        ? "var(--neg)"
        : "var(--ink-3)";

  return (
    <div className="card fade-in" style={{ padding: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 10,
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 14 }}>
          Mutual funds · {funds.length}
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono, monospace)",
            color: dayTone,
            fontSize: 13,
          }}
        >
          {weighted_day_change_pct >= 0 ? "+" : ""}
          {weighted_day_change_pct.toFixed(2)}% today (weighted)
        </div>
      </div>
      <p
        style={{
          margin: "0 0 14px",
          fontSize: 13.5,
          color: "var(--ink-2)",
          lineHeight: 1.5,
        }}
      >
        {summary}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {funds.map((f) => {
          const tone =
            f.day_change_pct > 0
              ? "var(--pos)"
              : f.day_change_pct < 0
                ? "var(--neg)"
                : "var(--ink-3)";
          const overallTone =
            f.overall_gain_pct > 0
              ? "var(--pos)"
              : f.overall_gain_pct < 0
                ? "var(--neg)"
                : "var(--ink-3)";
          return (
            <div
              key={f.scheme_code}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto auto",
                gap: 12,
                alignItems: "center",
                padding: "10px 12px",
                background: "var(--bg-elev)",
                border: "1px solid var(--line)",
                borderRadius: 8,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--ink-1)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={f.scheme_name}
                >
                  {f.scheme_name}
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>
                  {f.amc} · {f.category} · {f.weight_pct.toFixed(1)}% of book
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: 12.5,
                    color: tone,
                  }}
                >
                  {f.day_change_pct >= 0 ? "+" : ""}
                  {f.day_change_pct.toFixed(2)}%
                </div>
                <div
                  style={{
                    fontSize: 10.5,
                    color: "var(--ink-3)",
                    marginTop: 2,
                  }}
                >
                  today
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: 12.5,
                    color: overallTone,
                  }}
                >
                  {f.overall_gain_pct >= 0 ? "+" : ""}
                  {f.overall_gain_pct.toFixed(2)}%
                </div>
                <div
                  style={{
                    fontSize: 10.5,
                    color: "var(--ink-3)",
                    marginTop: 2,
                  }}
                >
                  total
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
