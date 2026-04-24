"use client";

import type { StockQuote } from "@/lib/api";

export function StockCard({
  quote,
  summary,
}: {
  quote: StockQuote;
  summary?: string;
}) {
  const pct = quote.change_pct;
  const dir = pct == null ? "" : pct < 0 ? "neg" : "pos";
  const color = pct == null ? "var(--ink)" : pct < 0 ? "var(--neg)" : "var(--pos)";

  return (
    <div className="card fade-up">
      <div className="card-head">
        <div className="card-title">
          <span className={`dot ${dir}`} />
          {quote.symbol}
          {quote.title ? (
            <span className="dim" style={{ fontWeight: 400 }}>
              {" · "}
              {quote.title}
            </span>
          ) : null}
        </div>
        <div className="card-sub">Live quote · Google Finance</div>
      </div>
      <div className="card-body">
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 16,
            paddingBottom: summary ? 14 : 0,
            borderBottom: summary ? "1px dashed var(--line)" : "none",
            marginBottom: summary ? 14 : 0,
          }}
        >
          <div
            className="serif"
            style={{ fontSize: 38, letterSpacing: "-0.02em", color }}
          >
            {quote.price != null ? quote.price.toFixed(2) : "—"}
          </div>
          <div
            className="mono"
            style={{ fontSize: 14, color: "var(--ink-3)" }}
          >
            {quote.currency ?? ""}
          </div>
          <div
            className="mono tnum"
            style={{ marginLeft: "auto", fontSize: 16, color }}
          >
            {pct == null
              ? "—"
              : `${pct >= 0 ? "+" : "−"}${Math.abs(pct).toFixed(2)}%`}
          </div>
        </div>

        {summary && (
          <p
            style={{
              margin: 0,
              fontSize: 13.5,
              lineHeight: 1.55,
              color: "var(--ink-2)",
              whiteSpace: "pre-wrap",
            }}
          >
            {summary}
          </p>
        )}
      </div>
    </div>
  );
}
