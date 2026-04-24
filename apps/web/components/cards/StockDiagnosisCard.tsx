"use client";

import type { StockDiagnosis } from "@/lib/api";

export function StockDiagnosisCard({
  diagnosis,
}: {
  diagnosis: StockDiagnosis;
}) {
  const { quote, headlines, reasoning } = diagnosis;
  const pct = quote.change_pct;
  const color = pct == null ? "var(--ink)" : pct < 0 ? "var(--neg)" : "var(--pos)";
  const dir = pct == null ? "" : pct < 0 ? "neg" : "pos";

  return (
    <div className="card fade-up">
      <div className="card-head">
        <div className="card-title">
          <span className={`dot ${dir}`} />
          {diagnosis.symbol} — diagnosis
        </div>
        <div className="card-sub">
          Quote · headlines · reasoning
        </div>
      </div>
      <div className="card-body">
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 12,
            paddingBottom: 12,
            borderBottom: "1px dashed var(--line)",
            marginBottom: 14,
          }}
        >
          <div
            className="serif"
            style={{ fontSize: 28, letterSpacing: "-0.02em", color }}
          >
            {quote.price != null ? quote.price.toFixed(2) : "—"}
          </div>
          <div className="mono" style={{ fontSize: 12, color: "var(--ink-3)" }}>
            {quote.currency ?? ""}
          </div>
          <div
            className="mono tnum"
            style={{ marginLeft: "auto", fontSize: 14, color }}
          >
            {pct == null
              ? "—"
              : `${pct >= 0 ? "+" : "−"}${Math.abs(pct).toFixed(2)}%`}
          </div>
        </div>

        <p
          style={{
            margin: "0 0 16px",
            fontSize: 13.5,
            lineHeight: 1.55,
            color: "var(--ink-2)",
            whiteSpace: "pre-wrap",
          }}
        >
          {reasoning}
        </p>

        {headlines.length > 0 && (
          <>
            <div className="eyebrow" style={{ marginBottom: 8 }}>
              Cited headlines
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {headlines.slice(0, 6).map((h, i) => (
                <li
                  key={`${h.url}-${i}`}
                  style={{
                    padding: "8px 0",
                    borderTop: i === 0 ? "none" : "1px solid var(--line)",
                  }}
                >
                  <a
                    href={h.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      color: "var(--ink)",
                      textDecoration: "none",
                      fontSize: 13,
                      fontWeight: 500,
                      lineHeight: 1.4,
                    }}
                  >
                    {h.title}
                  </a>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--ink-3)",
                      marginTop: 3,
                    }}
                  >
                    {h.source}
                    {h.date ? ` · ${h.date}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
