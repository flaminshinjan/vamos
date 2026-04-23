"use client";

import type { RelevantNews } from "@/lib/api";

export function NewsCard({ news }: { news: RelevantNews[] }) {
  return (
    <div className="card fade-up">
      <div className="card-head">
        <div className="card-title">
          <span className="dot accent" /> Classified news · {news.length} signals
        </div>
        <div className="card-sub">sentiment + scope + impact</div>
      </div>
      <div className="card-body" style={{ padding: 0 }}>
        {news.map((n, i) => {
          const s = n.article.sentiment;
          const borderColor =
            s === "POSITIVE"
              ? "var(--pos)"
              : s === "NEGATIVE"
                ? "var(--neg)"
                : "var(--ink-4)";
          return (
            <div
              key={n.article.id}
              style={{
                padding: "14px 18px",
                borderBottom:
                  i < news.length - 1 ? "1px solid var(--line)" : "none",
                borderLeft: `3px solid ${borderColor}`,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  lineHeight: 1.45,
                  marginBottom: 8,
                }}
              >
                {n.article.headline}
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  alignItems: "center",
                }}
              >
                <span
                  className={`pill ${
                    s === "POSITIVE" ? "pos" : s === "NEGATIVE" ? "neg" : ""
                  }`}
                >
                  {s.toLowerCase()}
                </span>
                <span className="pill">{formatScope(n.article.scope)}</span>
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--ink-3)",
                    marginLeft: 2,
                  }}
                >
                  {n.article.source}
                </span>
                <span
                  className="mono"
                  style={{ marginLeft: "auto", fontSize: 11 }}
                >
                  <span style={{ color: "var(--ink-4)", marginRight: 5 }}>
                    IMPACT
                  </span>
                  <span style={{ color: "var(--accent)" }}>
                    {n.relevance_score.toFixed(2)}
                  </span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatScope(s: string): string {
  return s
    .replace(/_/g, "-")
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
}
