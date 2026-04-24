"use client";

import type { SectorPerformancePayload } from "@/lib/api";

export function SectorPerformanceCard({
  sector,
}: {
  sector: SectorPerformancePayload;
}) {
  const q = sector.index_quote;
  const pct = q?.change_pct ?? null;
  const color =
    pct == null ? "var(--ink)" : pct < 0 ? "var(--neg)" : "var(--pos)";
  const dir = pct == null ? "" : pct < 0 ? "neg" : "pos";

  return (
    <div className="card fade-up">
      <div className="card-head">
        <div className="card-title">
          <span className={`dot ${dir}`} />
          {sector.sector} sector
        </div>
        <div className="card-sub">Index quote + headlines</div>
      </div>
      <div className="card-body">
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 16,
            paddingBottom: 12,
            borderBottom: "1px dashed var(--line)",
            marginBottom: 14,
          }}
        >
          <div
            className="serif"
            style={{ fontSize: 28, letterSpacing: "-0.02em", color }}
          >
            {q?.price != null ? q.price.toFixed(2) : "—"}
          </div>
          <div className="mono" style={{ fontSize: 12, color: "var(--ink-3)" }}>
            {q?.currency ?? ""}
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
            color: "var(--ink-2)",
            lineHeight: 1.55,
          }}
        >
          {sector.summary}
        </p>

        {sector.headlines.length > 0 && (
          <>
            <div className="eyebrow" style={{ marginBottom: 8 }}>
              Sector headlines
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {sector.headlines.slice(0, 6).map((h, i) => (
                <li
                  key={`${h.url}-${i}`}
                  style={{
                    padding: "6px 0",
                    borderTop: i === 0 ? "none" : "1px solid var(--line)",
                    fontSize: 12.5,
                  }}
                >
                  <a
                    href={h.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "var(--ink)", textDecoration: "none" }}
                  >
                    {h.title}
                  </a>
                  <span style={{ color: "var(--ink-3)", marginLeft: 6 }}>
                    · {h.source}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
