"use client";

import { useEffect, useState } from "react";

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
  const allDone = steps.length > 0 && steps.every((s) => s.status === "done");
  const activeIdx = steps.findIndex((s) => s.status === "active");
  const doneCount = steps.filter((s) => s.status === "done").length;

  // While running, stay open. Once done, collapse so the trace doesn't
  // dominate the conversation. The user can click to re-expand.
  const [open, setOpen] = useState(!allDone);
  useEffect(() => {
    if (allDone) setOpen(false);
  }, [allDone]);

  const subText = allDone && totalMs
    ? `${(totalMs / 1000).toFixed(1)}s${
        tokenUsage?.output_tokens ? ` · ${tokenUsage.output_tokens} tok` : ""
      }`
    : `${
        Math.min(
          (activeIdx === -1 ? doneCount : activeIdx) + 1,
          Math.max(steps.length, 1),
        )
      }/${steps.length || "…"}`;

  return (
    <div
      className="fade-up"
      style={{
        border: "1px solid var(--line)",
        borderRadius: 8,
        background: "var(--bg-elev)",
        marginTop: 8,
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{
          width: "100%",
          background: "transparent",
          border: 0,
          padding: "6px 10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          color: "var(--ink-2)",
          font: "inherit",
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 11.5,
            fontWeight: 500,
          }}
        >
          <span
            className={allDone ? "" : "pulse"}
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: allDone ? "var(--pos)" : "var(--accent)",
              flexShrink: 0,
            }}
          />
          <span>{allDone ? "Reasoning trace" : "Thinking…"}</span>
        </span>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 10.5,
            fontFamily: "'JetBrains Mono', monospace",
            color: "var(--ink-3)",
          }}
        >
          <span>{subText}</span>
          <Caret open={open} />
        </span>
      </button>
      {open && (
        <div
          style={{
            padding: "4px 10px 8px",
            borderTop: "1px solid var(--line)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {steps.map((s, i) => (
            <CompactStep key={s.id} step={s} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function CompactStep({ step, index }: { step: ToolCallStep; index: number }) {
  const dur =
    step.status === "done" && step.duration_ms
      ? `${(step.duration_ms / 1000).toFixed(1)}s`
      : step.status === "active"
        ? "…"
        : "";
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "16px 1fr auto",
        gap: 8,
        alignItems: "center",
        padding: "4px 0",
        opacity: step.status === "pending" ? 0.45 : 1,
      }}
    >
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: "50%",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            step.status === "done"
              ? "var(--pos-soft)"
              : step.status === "active"
                ? "var(--accent-soft)"
                : "transparent",
          border:
            step.status === "pending" ? "1px solid var(--line)" : "none",
          fontSize: 9,
          fontFamily: "'JetBrains Mono', monospace",
          color: "var(--ink-3)",
        }}
      >
        {step.status === "done" ? (
          <svg width="8" height="8" viewBox="0 0 10 10">
            <path
              d="M2 5 L4 7 L8 3"
              stroke="var(--pos)"
              strokeWidth="1.6"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : step.status === "active" ? (
          <span
            className="pulse"
            style={{
              width: 4,
              height: 4,
              borderRadius: "50%",
              background: "var(--accent)",
            }}
          />
        ) : (
          <span>{index + 1}</span>
        )}
      </span>
      <span
        style={{
          fontSize: 11.5,
          color: "var(--ink-1)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={step.detail}
      >
        {step.label}
        {step.detail && (
          <span style={{ color: "var(--ink-3)", marginLeft: 6 }}>
            · {step.detail}
          </span>
        )}
      </span>
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          color: "var(--ink-3)",
          minWidth: 28,
          textAlign: "right",
        }}
      >
        {dur}
      </span>
    </div>
  );
}

function Caret({ open }: { open: boolean }) {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 10 10"
      style={{
        transition: "transform 120ms ease",
        transform: open ? "rotate(180deg)" : "rotate(0deg)",
      }}
    >
      <path
        d="M2 4 L5 7 L8 4"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
