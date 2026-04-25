"use client";

import { useEffect, useRef, useState } from "react";
import type { NoteTone } from "@/lib/api";
import { Markdown } from "@/components/Markdown";

// Plain text bubble with a typewriter reveal — used by tools that don't
// need card chrome (explain_portfolio_move, compare_portfolio_to_market,
// graceful-degradation messages from SerpApi tools, etc.).
//
// `animate` defaults to true on first render but flips off once the text
// is fully revealed, so persisted/restored notes don't re-animate.

const CHAR_INTERVAL_MS = 12;
const CHARS_PER_TICK = 3;

export function NoteCard({
  text,
  tone = "neutral",
  animate = true,
}: {
  text: string;
  tone?: NoteTone;
  animate?: boolean;
}) {
  const [shown, setShown] = useState(animate ? 0 : text.length);
  const lastTextRef = useRef(text);

  useEffect(() => {
    if (lastTextRef.current !== text) {
      lastTextRef.current = text;
      setShown(animate ? 0 : text.length);
    }
  }, [text, animate]);

  useEffect(() => {
    if (!animate) return;
    if (shown >= text.length) return;
    const id = window.setTimeout(() => {
      setShown((s) => Math.min(text.length, s + CHARS_PER_TICK));
    }, CHAR_INTERVAL_MS);
    return () => window.clearTimeout(id);
  }, [shown, text, animate]);

  const accent =
    tone === "positive"
      ? "var(--pos)"
      : tone === "negative"
        ? "var(--neg)"
        : "var(--ink-3)";

  const isStreaming = animate && shown < text.length;

  return (
    <div
      className="fade-in"
      style={{
        position: "relative",
        paddingLeft: 12,
        borderLeft: `2px solid ${accent}`,
        lineHeight: 1.55,
        color: "var(--ink-1)",
      }}
    >
      <Markdown>{text.slice(0, shown)}</Markdown>
      {isStreaming && (
        <span
          aria-hidden
          style={{
            display: "inline-block",
            width: 6,
            height: 14,
            marginLeft: 2,
            marginTop: -10,
            verticalAlign: "-2px",
            background: "var(--ink-2)",
            opacity: 0.65,
            animation: "blink 0.9s steps(2, start) infinite",
          }}
        />
      )}
    </div>
  );
}
