"use client";

import { useEffect, useState } from "react";
import type { AdvisorBriefing, EvaluationResult } from "@/lib/api";

// Typewriter that types chars progressively at ~60 chars / 16ms — fast enough
// that a 300-char summary finishes in under a second, slow enough that it
// still reads as streamed.
function useTypewriter(fullText: string, step = 4, interval = 16): string {
  const [typed, setTyped] = useState("");
  useEffect(() => {
    setTyped("");
    if (!fullText) return;
    let i = 0;
    const iv = setInterval(() => {
      i = Math.min(i + step, fullText.length);
      setTyped(fullText.slice(0, i));
      if (i >= fullText.length) clearInterval(iv);
    }, interval);
    return () => clearInterval(iv);
  }, [fullText, step, interval]);
  return typed;
}

export function BriefingCard({
  briefing,
  evaluation,
}: {
  briefing: AdvisorBriefing;
  evaluation: EvaluationResult | null;
}) {
  const fullText = [briefing.headline, briefing.summary].filter(Boolean).join("\n\n");
  const typed = useTypewriter(fullText);
  const typing = typed.length < fullText.length;

  // Derive per-criterion scores from evaluation + briefing
  const scores = buildScores(briefing, evaluation);

  const confidencePct = Math.round(briefing.confidence * 100);
  const usage = briefing.token_usage ?? {};

  return (
    <div
      className="card fade-up"
      style={{ borderColor: "var(--ink-2)" }}
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
          <span className="dot" style={{ background: "#FBC97A" }} />
          Agent briefing · {briefing.user_name}
        </div>
        <div className="card-sub" style={{ color: "rgba(255,253,248,0.5)" }}>
          confidence {confidencePct}%
        </div>
      </div>
      <div className="card-body">
        <div
          className="serif"
          style={{
            fontSize: 18,
            lineHeight: 1.5,
            letterSpacing: "-0.005em",
            whiteSpace: "pre-wrap",
            color: "var(--ink)",
            marginBottom: 18,
          }}
        >
          {typed}
          {typing && (
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: "1em",
                background: "var(--ink)",
                marginLeft: 2,
                verticalAlign: "text-bottom",
                animation: "pulseDot 0.9s ease-in-out infinite",
              }}
            />
          )}
        </div>

        {briefing.causal_chains.length > 0 && (
          <div
            style={{
              paddingTop: 14,
              paddingBottom: 14,
              borderTop: "1px dashed var(--line)",
            }}
          >
            {briefing.causal_chains.map((c, i) => (
              <div
                key={i}
                style={{
                  fontSize: 13,
                  lineHeight: 1.55,
                  padding: "6px 0",
                  color: "var(--ink-2)",
                }}
              >
                <span className="mono" style={{ color: "var(--accent)", marginRight: 8 }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                {c.narrative}
              </div>
            ))}
          </div>
        )}

        {briefing.conflicts.length > 0 && (
          <div
            style={{
              paddingTop: 12,
              paddingBottom: 12,
              borderTop: "1px dashed var(--line)",
            }}
          >
            <div className="eyebrow" style={{ marginBottom: 8 }}>
              Conflicting signals
            </div>
            {briefing.conflicts.map((c, i) => (
              <div
                key={i}
                style={{
                  fontSize: 12.5,
                  color: "var(--ink-2)",
                  padding: "4px 0",
                }}
              >
                <span className="pill warn" style={{ fontSize: 9 }}>
                  {c.stock_or_sector}
                </span>{" "}
                {c.explanation}
              </div>
            ))}
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 14,
            paddingTop: 16,
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

        <div
          style={{
            marginTop: 16,
            paddingTop: 14,
            borderTop: "1px dashed var(--line)",
            display: "flex",
            justifyContent: "space-between",
            fontSize: 11.5,
            color: "var(--ink-3)",
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
            spans ·{" "}
            <span className="mono" style={{ color: "var(--ink)" }}>
              {briefing.latency_ms ? (briefing.latency_ms / 1000).toFixed(1) : "—"}s
            </span>
          </span>
          {briefing.trace_id && (
            <span
              className="mono"
              style={{ fontSize: 10, color: "var(--ink-4)" }}
            >
              trace {briefing.trace_id.slice(0, 8)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function buildScores(
  briefing: AdvisorBriefing,
  evaluation: EvaluationResult | null,
): Array<{ k: string; v: number }> {
  if (!evaluation) {
    // Still-loading state: show confidence only while eval spins up
    return [
      { k: "Confidence", v: briefing.confidence },
      { k: "Causal depth", v: briefing.causal_chains.length > 0 ? 0.6 : 0.2 },
      {
        k: "Coverage",
        v: Math.min(1, briefing.key_insights.length / 4),
      },
      {
        k: "Conflict handling",
        v: briefing.conflicts.length > 0 ? 0.8 : 0.6,
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
    { k: "Confidence", v: briefing.confidence },
    {
      k: "Conflict handling",
      v: briefing.conflicts.length > 0 ? 0.85 : 0.65,
    },
  ];
}
