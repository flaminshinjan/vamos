"use client";

import type { AdvisorBriefing, EvaluationResult } from "@/lib/api";

// Shape accepted while data is still streaming — every field optional.
export type PartialBriefing = Partial<AdvisorBriefing> & {
  headline?: string;
  summary?: string;
  causal_chains?: AdvisorBriefing["causal_chains"];
  key_insights?: AdvisorBriefing["key_insights"];
  conflicts?: AdvisorBriefing["conflicts"];
  recommendations?: AdvisorBriefing["recommendations"];
  confidence?: number;
  confidence_rationale?: string;
};

export function BriefingCard({
  briefing,
  evaluation,
  streaming = false,
}: {
  briefing: AdvisorBriefing | PartialBriefing;
  evaluation: EvaluationResult | null;
  streaming?: boolean;
}) {
  const confidence =
    typeof briefing.confidence === "number" ? briefing.confidence : null;
  const confidencePct = confidence != null ? Math.round(confidence * 100) : null;

  const chains = briefing.causal_chains ?? [];
  const insights = briefing.key_insights ?? [];
  const conflicts = briefing.conflicts ?? [];
  const recommendations = briefing.recommendations ?? [];

  // Only compute these when we have a real AdvisorBriefing (final event fired)
  const isFull = "portfolio_id" in briefing && (briefing as AdvisorBriefing).portfolio_id;
  const scores = buildScores(briefing as AdvisorBriefing, evaluation, isFull as boolean);
  const usage = ("token_usage" in briefing ? briefing.token_usage : undefined) ?? {};
  const traceId = "trace_id" in briefing ? briefing.trace_id : undefined;
  const latencyMs = "latency_ms" in briefing ? briefing.latency_ms : undefined;
  const userName = "user_name" in briefing ? briefing.user_name : "Portfolio";

  return (
    <div
      className="card fade-up"
      style={{ borderColor: streaming ? "var(--accent)" : "var(--ink-2)" }}
    >
      <div
        className="card-head"
        style={{
          background: "var(--ink)",
          color: "var(--bg)",
          borderColor: "var(--ink-2)",
        }}
      >
        <div className="card-title">
          <span
            className={`dot ${streaming ? "pulse" : ""}`}
            style={{ background: streaming ? "#FBC97A" : "#FBC97A" }}
          />
          {streaming ? "Streaming briefing" : "Agent briefing"} · {userName}
        </div>
        <div className="card-sub" style={{ color: "rgba(255,253,248,0.5)" }}>
          {confidencePct != null
            ? `confidence ${confidencePct}%`
            : streaming
              ? "generating…"
              : "—"}
        </div>
      </div>

      <div className="card-body">
        {/* Headline — streams in as first tokens arrive */}
        {briefing.headline ? (
          <h4
            className="serif"
            style={{
              fontSize: 22,
              lineHeight: 1.22,
              letterSpacing: "-0.015em",
              margin: "0 0 8px",
              color: "var(--ink)",
            }}
          >
            {briefing.headline}
            {streaming && !briefing.summary && <StreamCursor />}
          </h4>
        ) : streaming ? (
          <div style={{ fontSize: 13, color: "var(--ink-4)", marginBottom: 12 }}>
            <span className="typing-indicator" style={{ padding: "3px 8px" }}>
              <span />
              <span />
              <span />
            </span>{" "}
            Reasoning…
          </div>
        ) : null}

        {/* Summary — multi-sentence, streams word by word */}
        {briefing.summary && (
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.55,
              color: "var(--ink-2)",
              margin: "0 0 16px",
              whiteSpace: "pre-wrap",
            }}
          >
            {briefing.summary}
            {streaming && <StreamCursor />}
          </p>
        )}

        {/* Causal chains — appear as each is completed */}
        {chains.length > 0 && (
          <div
            style={{
              paddingTop: 14,
              paddingBottom: 14,
              borderTop: "1px dashed var(--line)",
            }}
          >
            <div className="eyebrow" style={{ marginBottom: 10 }}>
              Causal chains
            </div>
            {chains.map((c, i) => {
              // Tolerant to partial objects — guard each field
              if (!c) return null;
              return (
                <div
                  key={i}
                  className="fade-in"
                  style={{
                    fontSize: 13.5,
                    lineHeight: 1.55,
                    padding: "8px 0",
                    color: "var(--ink-2)",
                    borderBottom:
                      i < chains.length - 1 ? "1px dashed var(--line)" : "none",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                      marginBottom: 4,
                      alignItems: "center",
                    }}
                  >
                    <span
                      className="mono"
                      style={{ color: "var(--accent)", fontSize: 11 }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {c.trigger && (
                      <span style={{ color: "var(--ink)" }}>{c.trigger}</span>
                    )}
                    {c.sector && (
                      <>
                        <Arrow />
                        <span
                          className="pill accent"
                          style={{ fontSize: 10 }}
                        >
                          {c.sector}
                          {typeof c.sector_impact_pct === "number" &&
                            ` ${fmtPct(c.sector_impact_pct)}`}
                        </span>
                      </>
                    )}
                    {c.stocks && c.stocks.length > 0 && (
                      <>
                        <Arrow />
                        <span style={{ color: "var(--ink)" }}>
                          {c.stocks.join(", ")}
                        </span>
                      </>
                    )}
                    {typeof c.portfolio_impact_pct === "number" && (
                      <>
                        <Arrow />
                        <span
                          className="mono tnum"
                          style={{
                            color:
                              c.portfolio_impact_pct >= 0
                                ? "var(--pos)"
                                : "var(--neg)",
                          }}
                        >
                          {fmtPct(c.portfolio_impact_pct)}
                        </span>
                      </>
                    )}
                  </div>
                  {c.narrative && (
                    <div style={{ color: "var(--ink-3)", fontSize: 12.5 }}>
                      {c.narrative}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Key insights */}
        {insights.length > 0 && (
          <div style={{ paddingTop: 12, paddingBottom: 4 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>
              Key insights
            </div>
            {insights.map((i, idx) => {
              if (!i) return null;
              const sev = i.severity ?? "INFO";
              const pillClass =
                sev === "CRITICAL" ? "neg" : sev === "WARN" ? "warn" : "accent";
              return (
                <div
                  key={idx}
                  className="fade-in"
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                    padding: "7px 0",
                    fontSize: 13,
                  }}
                >
                  <span className={`pill ${pillClass}`} style={{ fontSize: 9 }}>
                    {sev}
                  </span>
                  <div style={{ flex: 1 }}>
                    {i.title && (
                      <div style={{ fontWeight: 500, color: "var(--ink)" }}>
                        {i.title}
                      </div>
                    )}
                    {i.detail && (
                      <div style={{ color: "var(--ink-3)", marginTop: 2 }}>
                        {i.detail}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Conflicts */}
        {conflicts.length > 0 && (
          <div
            style={{
              paddingTop: 12,
              paddingBottom: 12,
              borderTop: "1px dashed var(--line)",
              marginTop: 12,
            }}
          >
            <div className="eyebrow" style={{ marginBottom: 8 }}>
              Conflicting signals
            </div>
            {conflicts.map((c, i) => {
              if (!c) return null;
              return (
                <div
                  key={i}
                  className="fade-in"
                  style={{
                    fontSize: 12.5,
                    color: "var(--ink-2)",
                    padding: "4px 0",
                  }}
                >
                  {c.stock_or_sector && (
                    <span className="pill warn" style={{ fontSize: 9 }}>
                      {c.stock_or_sector}
                    </span>
                  )}{" "}
                  {c.explanation ?? ""}
                </div>
              );
            })}
          </div>
        )}

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>
              Recommendations
            </div>
            <ul
              style={{
                margin: 0,
                paddingLeft: 18,
                fontSize: 13,
                color: "var(--ink-2)",
                lineHeight: 1.6,
              }}
            >
              {recommendations.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Confidence rationale */}
        {briefing.confidence_rationale && (
          <div
            style={{
              marginTop: 16,
              paddingTop: 12,
              borderTop: "1px dashed var(--line)",
              fontSize: 11.5,
              color: "var(--ink-3)",
            }}
          >
            <span className="mono" style={{ color: "var(--ink-4)" }}>
              WHY THIS CONFIDENCE →
            </span>{" "}
            {briefing.confidence_rationale}
          </div>
        )}

        {/* Self-eval scores — only shown once briefing is complete */}
        {!streaming && scores.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 14,
              paddingTop: 16,
              marginTop: 12,
              borderTop: "1px dashed var(--line)",
            }}
          >
            {scores.map((s) => (
              <div key={s.k}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 11.5,
                    marginBottom: 5,
                  }}
                >
                  <span style={{ color: "var(--ink-3)" }}>{s.k}</span>
                  <span className="mono tnum" style={{ color: "var(--accent)" }}>
                    {s.v.toFixed(2)}
                  </span>
                </div>
                <div
                  style={{
                    height: 3,
                    background: "var(--bg-sunk)",
                    borderRadius: 2,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${s.v * 100}%`,
                      height: "100%",
                      background: "var(--accent)",
                      transition: "width 0.5s ease",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Eval in-flight */}
        {!streaming && !evaluation && "portfolio_id" in briefing && (
          <div
            style={{
              marginTop: 12,
              paddingTop: 10,
              borderTop: "1px dashed var(--line)",
              fontSize: 11.5,
              color: "var(--ink-3)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span className="typing-indicator" style={{ padding: "2px 8px" }}>
              <span />
              <span />
              <span />
            </span>
            Grading reasoning…
          </div>
        )}

        {/* Footer */}
        {(traceId || latencyMs || Object.keys(usage).length > 0) && (
          <div
            style={{
              marginTop: 12,
              paddingTop: 10,
              borderTop: "1px dashed var(--line)",
              display: "flex",
              justifyContent: "space-between",
              fontSize: 11,
              color: "var(--ink-3)",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <span>
              <span className="mono" style={{ color: "var(--ink)" }}>
                {(usage.output_tokens ?? 0) + (usage.input_tokens ?? 0)}
              </span>{" "}
              tokens ·{" "}
              <span className="mono" style={{ color: "var(--ink)" }}>
                {evaluation ? "2" : "1"}
              </span>{" "}
              spans
              {latencyMs != null && (
                <>
                  {" "}
                  ·{" "}
                  <span className="mono" style={{ color: "var(--ink)" }}>
                    {(latencyMs / 1000).toFixed(1)}s
                  </span>
                </>
              )}
            </span>
            {traceId && (
              <span className="mono" style={{ fontSize: 10, color: "var(--ink-4)" }}>
                trace {traceId.slice(0, 8)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Arrow() {
  return (
    <span style={{ color: "var(--ink-4)", fontFamily: "JetBrains Mono", fontSize: 11 }}>
      →
    </span>
  );
}

function StreamCursor() {
  return (
    <span
      style={{
        display: "inline-block",
        width: 7,
        height: "1em",
        background: "var(--accent)",
        marginLeft: 3,
        verticalAlign: "text-bottom",
        animation: "pulseDot 0.9s ease-in-out infinite",
      }}
    />
  );
}

function fmtPct(n: number): string {
  const sign = n >= 0 ? "+" : "−";
  return `${sign}${Math.abs(n).toFixed(2)}%`;
}

function buildScores(
  briefing: AdvisorBriefing,
  evaluation: EvaluationResult | null,
  isFull: boolean,
): Array<{ k: string; v: number }> {
  if (!isFull) return [];
  if (!evaluation) {
    return [
      { k: "Confidence", v: briefing.confidence ?? 0.5 },
      {
        k: "Causal depth",
        v: (briefing.causal_chains?.length ?? 0) > 0 ? 0.6 : 0.2,
      },
      {
        k: "Coverage",
        v: Math.min(1, (briefing.key_insights?.length ?? 0) / 4),
      },
      {
        k: "Conflict handling",
        v: (briefing.conflicts?.length ?? 0) > 0 ? 0.8 : 0.6,
      },
    ];
  }
  const depthScore =
    evaluation.causal_depth === "DEEP"
      ? 0.9
      : evaluation.causal_depth === "MODERATE"
        ? 0.7
        : 0.4;
  return [
    { k: "Causal depth", v: depthScore },
    { k: "Coverage", v: evaluation.score },
    { k: "Confidence", v: briefing.confidence ?? 0.5 },
    {
      k: "Conflict handling",
      v: (briefing.conflicts?.length ?? 0) > 0 ? 0.85 : 0.65,
    },
  ];
}
