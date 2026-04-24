"use client";

import type { TrendMover, TrendScanPayload } from "@/lib/api";

export function TrendScanCard({ scan }: { scan: TrendScanPayload }) {
  return (
    <div className="card fade-up">
      <div className="card-head">
        <div className="card-title">
          <span className="dot accent" />
          Trend scan · holdings
        </div>
        <div className="card-sub">5-day & 20-day momentum</div>
      </div>
      <div className="card-body">
        <p
          style={{
            margin: "0 0 16px",
            fontSize: 13.5,
            color: "var(--ink-2)",
          }}
        >
          {scan.summary}
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 24,
          }}
        >
          <Column label="Up movers" tone="pos" movers={scan.up_movers} />
          <Column label="Down movers" tone="neg" movers={scan.down_movers} />
        </div>
      </div>
    </div>
  );
}

function Column({
  label,
  tone,
  movers,
}: {
  label: string;
  tone: "pos" | "neg";
  movers: TrendMover[];
}) {
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 10 }}>
        {label}
      </div>
      {movers.length === 0 ? (
        <div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>—</div>
      ) : (
        movers.map((m) => (
          <div
            key={m.symbol}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              padding: "5px 0",
              fontSize: 12.5,
            }}
          >
            <span style={{ fontWeight: 500 }}>{m.symbol}</span>
            <span
              className="mono tnum"
              style={{
                color: tone === "pos" ? "var(--pos)" : "var(--neg)",
              }}
            >
              {fmtPct(m.change_pct_5d)}
              <span style={{ color: "var(--ink-4)", marginLeft: 8, fontSize: 11 }}>
                20d {fmtPct(m.change_pct_20d)}
              </span>
            </span>
          </div>
        ))
      )}
    </div>
  );
}

function fmtPct(v: number | null): string {
  if (v == null) return "—";
  return `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(2)}%`;
}
