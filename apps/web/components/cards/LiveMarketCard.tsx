"use client";

import type { LiveMarketPayload } from "@/lib/api";

export function LiveMarketCard({ payload }: { payload: LiveMarketPayload }) {
  const { indices, avg_change_pct, sentiment, summary } = payload;
  const tone =
    sentiment === "BULLISH"
      ? "var(--pos)"
      : sentiment === "BEARISH"
        ? "var(--neg)"
        : "var(--ink-3)";
  return (
    <div className="card fade-in" style={{ padding: 14 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 8,
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: tone,
              display: "inline-block",
            }}
          />
          <span style={{ fontWeight: 600, fontSize: 13 }}>
            Live market · {sentiment}
          </span>
          <span
            style={{
              fontSize: 11,
              color: "var(--ink-3)",
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            Google Finance
          </span>
        </div>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12.5,
            color: tone,
          }}
        >
          {avg_change_pct >= 0 ? "+" : ""}
          {avg_change_pct.toFixed(2)}% avg
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${Math.min(indices.length, 2)}, 1fr)`,
          gap: 8,
          marginBottom: 10,
        }}
      >
        {indices.map((q) => {
          const t =
            q.change_pct == null
              ? "var(--ink-3)"
              : q.change_pct > 0
                ? "var(--pos)"
                : q.change_pct < 0
                  ? "var(--neg)"
                  : "var(--ink-3)";
          return (
            <div
              key={q.symbol}
              style={{
                padding: "8px 10px",
                background: "var(--bg-elev)",
                border: "1px solid var(--line)",
                borderRadius: 6,
              }}
            >
              <div style={{ fontSize: 11, color: "var(--ink-3)" }}>{q.symbol}</div>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  marginTop: 2,
                }}
              >
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                  {q.price != null ? q.price.toLocaleString("en-IN") : "—"}
                </span>
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 12,
                    color: t,
                  }}
                >
                  {q.change_pct != null
                    ? `${q.change_pct >= 0 ? "+" : ""}${q.change_pct.toFixed(2)}%`
                    : "—"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          color: "var(--ink-2)",
          lineHeight: 1.5,
        }}
      >
        {summary}
      </p>
    </div>
  );
}
