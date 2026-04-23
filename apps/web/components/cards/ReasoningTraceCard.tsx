"use client";

export type ToolCallStep = {
  id: string;
  label: string;
  detail: string;
  status: "pending" | "active" | "done";
  duration_ms?: number;
};

// Reasoning stages in display order — matches what advisor.brief_stream emits
export const DEFAULT_STEPS: ToolCallStep[] = [
  {
    id: "ingest_market_data",
    label: "Ingesting market data",
    detail: "NIFTY 50, SENSEX, sectoral indices",
    status: "pending",
  },
  {
    id: "classify_news",
    label: "Classifying news",
    detail: "headlines → sentiment + scope + entities",
    status: "pending",
  },
  {
    id: "compute_portfolio_exposure",
    label: "Computing portfolio exposure",
    detail: "Sector weights vs. news entities",
    status: "pending",
  },
  {
    id: "identify_causal_links",
    label: "Identifying causal links",
    detail: "High-impact paths only (>0.5)",
    status: "pending",
  },
  {
    id: "self_evaluate_output",
    label: "Self-evaluating output",
    detail: "Reasoning quality + coverage + confidence",
    status: "pending",
  },
];

export function ReasoningTraceCard({
  steps,
  tokenUsage,
  totalMs,
}: {
  steps: ToolCallStep[];
  tokenUsage?: Record<string, number>;
  totalMs?: number;
}) {
  const allDone = steps.every((s) => s.status === "done");
  const activeIdx = steps.findIndex((s) => s.status === "active");

  return (
    <div className="card fade-up">
      <div className="card-head">
        <div className="card-title">
          <span
            className={`dot ${allDone ? "pos" : "accent"} ${
              allDone ? "" : "pulse"
            }`}
          />
          {allDone ? "Reasoning complete" : "Thinking…"}
        </div>
        <div className="card-sub">
          {allDone && totalMs
            ? `${(totalMs / 1000).toFixed(1)}s${
                tokenUsage?.output_tokens
                  ? ` · ${tokenUsage.output_tokens} tokens`
                  : ""
              } · traced`
            : `step ${Math.min(
                (activeIdx === -1 ? steps.filter((s) => s.status === "done").length : activeIdx) + 1,
                steps.length,
              )} of ${steps.length}`}
        </div>
      </div>
      <div className="card-body">
        {steps.map((s, i) => (
          <div key={s.id} className={`reason-step ${s.status}`}>
            <div className="check">
              {s.status === "done" ? (
                <svg width="10" height="10" viewBox="0 0 10 10">
                  <path
                    d="M2 5 L4 7 L8 3"
                    stroke="var(--pos)"
                    strokeWidth="1.5"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : s.status === "active" ? (
                <div
                  className="pulse"
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "var(--accent)",
                  }}
                />
              ) : (
                <span
                  className="mono"
                  style={{ fontSize: 9, color: "var(--ink-4)" }}
                >
                  {i + 1}
                </span>
              )}
            </div>
            <div>
              <div className="lbl">{s.label}</div>
              <div className="det">{s.detail}</div>
            </div>
            <div className="t">
              {s.status === "done" && s.duration_ms
                ? `${(s.duration_ms / 1000).toFixed(1)}s`
                : s.status === "active"
                  ? "…"
                  : "—"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
