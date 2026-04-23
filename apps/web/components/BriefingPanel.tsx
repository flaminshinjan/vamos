"use client";

import { useCallback, useRef, useState } from "react";
import { type AdvisorBriefing, type EvaluationResult } from "@/lib/api";
import { formatPct, pnlColor, severityClasses } from "@/lib/format";
import { tryParsePartial } from "@/lib/partialJson";
import { readSSE } from "@/lib/sse";

type Phase =
  | "idle"
  | "analytics"       // analytics event received
  | "thinking"        // start event received, waiting for first token
  | "streaming"       // deltas arriving
  | "briefing"        // full briefing received
  | "evaluating"      // waiting for eval
  | "done"
  | "error";

type PartialBriefing = {
  headline?: string;
  summary?: string;
  causal_chains?: Array<{
    trigger?: string;
    sector?: string;
    sector_impact_pct?: number;
    stocks?: string[];
    portfolio_impact_pct?: number;
    narrative?: string;
  }>;
  key_insights?: Array<{ title?: string; detail?: string; severity?: string }>;
  conflicts?: Array<{
    stock_or_sector?: string;
    news_signal?: string;
    price_signal?: string;
    explanation?: string;
  }>;
  recommendations?: string[];
  confidence?: number;
  confidence_rationale?: string;
};

export function BriefingPanel({ portfolioId }: { portfolioId: string }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [partial, setPartial] = useState<PartialBriefing>({});
  const [briefing, setBriefing] = useState<AdvisorBriefing | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{
    firstTokenMs?: number;
    briefingMs?: number;
    evalMs?: number;
    totalMs?: number;
    usage?: Record<string, number>;
  }>({});

  const accumulatedRef = useRef("");
  const startedAtRef = useRef(0);

  const run = useCallback(async () => {
    // Reset
    setPhase("analytics");
    setError(null);
    setPartial({});
    setBriefing(null);
    setEvaluation(null);
    setStats({});
    accumulatedRef.current = "";
    startedAtRef.current = performance.now();
    let firstTokenAt = 0;

    try {
      const res = await fetch("/api/brief/stream", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ portfolio_id: portfolioId }),
      });
      if (!res.ok || !res.body) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text.slice(0, 300)}`);
      }

      for await (const frame of readSSE(res)) {
        if (frame.event === "start") {
          setPhase("thinking");
        } else if (frame.event === "delta") {
          if (!firstTokenAt) {
            firstTokenAt = performance.now();
            setStats((s) => ({
              ...s,
              firstTokenMs: Math.round(firstTokenAt - startedAtRef.current),
            }));
          }
          const d = frame.data as { text: string };
          accumulatedRef.current += d.text ?? "";
          const parsed = tryParsePartial<PartialBriefing>(accumulatedRef.current);
          if (parsed) setPartial(parsed);
          setPhase("streaming");
        } else if (frame.event === "briefing") {
          const b = frame.data as AdvisorBriefing;
          setBriefing(b);
          setPartial({
            headline: b.headline,
            summary: b.summary,
            causal_chains: b.causal_chains,
            key_insights: b.key_insights,
            conflicts: b.conflicts,
            recommendations: b.recommendations,
            confidence: b.confidence,
            confidence_rationale: b.confidence_rationale,
          });
          setStats((s) => ({
            ...s,
            briefingMs: Math.round(performance.now() - startedAtRef.current),
            usage: b.token_usage ?? undefined,
          }));
          setPhase("evaluating");
        } else if (frame.event === "evaluation") {
          const e = frame.data as EvaluationResult;
          setEvaluation(e);
          setStats((s) => ({
            ...s,
            evalMs: Math.round(performance.now() - startedAtRef.current),
          }));
        } else if (frame.event === "done") {
          setStats((s) => ({
            ...s,
            totalMs: Math.round(performance.now() - startedAtRef.current),
          }));
          setPhase("done");
        } else if (frame.event === "error") {
          const err = frame.data as { error: string };
          setError(err.error);
          setPhase("error");
          break;
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  }, [portfolioId]);

  const busy =
    phase === "analytics" ||
    phase === "thinking" ||
    phase === "streaming" ||
    phase === "evaluating";

  return (
    <section className="card">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Agent briefing</h3>
          <p className="text-xs text-neutral-500">
            News → Sector → Stock → Portfolio · Claude Sonnet 4.6 · streamed
          </p>
        </div>
        <button
          onClick={run}
          disabled={busy}
          className="rounded-lg bg-accent-blue px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-60"
        >
          {busy ? "Reasoning…" : briefing ? "Re-run" : "Generate briefing"}
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-accent-red/30 bg-accent-red/10 p-3 text-sm text-accent-red">
          {error}
        </div>
      )}

      <PhaseIndicator phase={phase} stats={stats} />

      {(phase !== "idle" || briefing) && (
        <div className="mt-5 space-y-6">
          {/* Headline + summary (stream in progressively) */}
          {(partial.headline || partial.summary) && (
            <div>
              {partial.headline && (
                <h4 className="text-xl font-semibold">{partial.headline}</h4>
              )}
              {partial.summary && (
                <p className="mt-2 whitespace-pre-wrap text-neutral-300">
                  {partial.summary}
                  {phase === "streaming" && (
                    <span className="inline-block animate-pulse text-neutral-500">▋</span>
                  )}
                </p>
              )}
            </div>
          )}

          {/* Causal chains */}
          {partial.causal_chains && partial.causal_chains.length > 0 && (
            <div>
              <div className="label mb-2">Causal chains</div>
              <div className="space-y-3">
                {partial.causal_chains.map((c, i) => (
                  <CausalChainRow key={i} chain={c} />
                ))}
              </div>
            </div>
          )}

          {/* Key insights */}
          {partial.key_insights && partial.key_insights.length > 0 && (
            <div>
              <div className="label mb-2">Key insights</div>
              <div className="space-y-2">
                {partial.key_insights.map((i, idx) => {
                  const sev =
                    (i.severity as "INFO" | "WARN" | "CRITICAL") ?? "INFO";
                  const cls = severityClasses(sev);
                  return (
                    <div
                      key={idx}
                      className={`rounded-lg bg-ink-900/60 p-3 ${cls.border}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`pill ${cls.pill}`}>{sev}</span>
                        {i.title && (
                          <span className="font-medium text-neutral-100">
                            {i.title}
                          </span>
                        )}
                      </div>
                      {i.detail && (
                        <p className="mt-1 text-sm text-neutral-300">{i.detail}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Conflicts */}
          {partial.conflicts && partial.conflicts.length > 0 && (
            <div>
              <div className="label mb-2">Conflicting signals</div>
              <div className="space-y-2">
                {partial.conflicts.map((c, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm"
                  >
                    {c.stock_or_sector && (
                      <div className="font-medium text-amber-300">
                        {c.stock_or_sector}
                      </div>
                    )}
                    {c.news_signal && (
                      <div className="mt-1 text-neutral-400">
                        news: <span className="text-neutral-200">{c.news_signal}</span>
                      </div>
                    )}
                    {c.price_signal && (
                      <div className="text-neutral-400">
                        price:{" "}
                        <span className="text-neutral-200">{c.price_signal}</span>
                      </div>
                    )}
                    {c.explanation && (
                      <div className="mt-1 text-neutral-300">→ {c.explanation}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {partial.recommendations && partial.recommendations.length > 0 && (
            <div>
              <div className="label mb-2">Recommendations</div>
              <ul className="list-inside list-disc space-y-1 text-sm text-neutral-300">
                {partial.recommendations.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Confidence + eval */}
          {(partial.confidence !== undefined || evaluation) && (
            <div className="grid gap-4 rounded-lg border border-ink-600 bg-ink-900/40 p-4 sm:grid-cols-2">
              {partial.confidence !== undefined && (
                <div>
                  <div className="label">Confidence</div>
                  <div className="mt-1 flex items-center gap-3">
                    <div className="text-3xl font-semibold">
                      {(partial.confidence * 100).toFixed(0)}%
                    </div>
                    <div className="h-2 flex-1 overflow-hidden rounded bg-ink-700">
                      <div
                        className="h-full bg-accent-blue transition-all"
                        style={{ width: `${partial.confidence * 100}%` }}
                      />
                    </div>
                  </div>
                  {partial.confidence_rationale && (
                    <p className="mt-2 text-xs text-neutral-500">
                      {partial.confidence_rationale}
                    </p>
                  )}
                </div>
              )}
              <div>
                <div className="label">Self-evaluation</div>
                {evaluation ? (
                  <>
                    <div className="mt-1 flex items-center gap-3">
                      <div className="text-3xl font-semibold">
                        {(evaluation.score * 100).toFixed(0)}%
                      </div>
                      <span className="pill bg-ink-700 text-neutral-300">
                        {evaluation.causal_depth}
                      </span>
                      <span className="pill bg-ink-700 text-neutral-400">
                        {evaluation.method}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-neutral-500">
                      {evaluation.rationale}
                    </p>
                    {evaluation.missing_elements.length > 0 && (
                      <p className="mt-1 text-xs text-neutral-500">
                        Missing:{" "}
                        {evaluation.missing_elements.slice(0, 3).join("; ")}
                      </p>
                    )}
                  </>
                ) : phase === "evaluating" ? (
                  <div className="mt-1 flex items-center gap-2 text-sm text-neutral-400">
                    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-neutral-500 border-t-transparent" />
                    Grading briefing…
                  </div>
                ) : (
                  <div className="mt-1 text-sm text-neutral-500">—</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function PhaseIndicator({
  phase,
  stats,
}: {
  phase: Phase;
  stats: {
    firstTokenMs?: number;
    briefingMs?: number;
    evalMs?: number;
    totalMs?: number;
    usage?: Record<string, number>;
  };
}) {
  if (phase === "idle") return null;

  const steps: Array<{ key: Phase; label: string }> = [
    { key: "analytics", label: "Analytics" },
    { key: "thinking", label: "Reasoning" },
    { key: "streaming", label: "Streaming" },
    { key: "briefing", label: "Briefing" },
    { key: "evaluating", label: "Eval" },
    { key: "done", label: "Done" },
  ];
  const current = steps.findIndex((s) => s.key === phase);

  return (
    <div className="mt-4 rounded-lg border border-ink-600 bg-ink-900/40 px-3 py-2">
      <div className="flex items-center gap-2 overflow-x-auto text-xs">
        {steps.map((s, i) => {
          const active = i === current;
          const done = i < current || phase === "done";
          return (
            <div key={s.key} className="flex items-center gap-2">
              <span
                className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                  active
                    ? "bg-accent-blue text-white"
                    : done
                      ? "bg-accent-green/30 text-accent-green"
                      : "bg-ink-700 text-neutral-500"
                }`}
              >
                {done && !active ? "✓" : i + 1}
              </span>
              <span
                className={
                  active
                    ? "font-medium text-neutral-100"
                    : done
                      ? "text-neutral-400"
                      : "text-neutral-600"
                }
              >
                {s.label}
              </span>
              {i < steps.length - 1 && (
                <span className="text-neutral-700">›</span>
              )}
            </div>
          );
        })}
      </div>
      {(stats.firstTokenMs || stats.briefingMs || stats.totalMs) && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-neutral-500">
          {stats.firstTokenMs && (
            <span>First token {stats.firstTokenMs}ms</span>
          )}
          {stats.briefingMs && <span>· Briefing {stats.briefingMs}ms</span>}
          {stats.evalMs && <span>· Eval {stats.evalMs}ms</span>}
          {stats.totalMs && <span>· Total {stats.totalMs}ms</span>}
          {stats.usage && (
            <span>
              · in {stats.usage.input_tokens ?? 0} · out{" "}
              {stats.usage.output_tokens ?? 0}
              {stats.usage.cache_read_input_tokens
                ? ` · cached ${stats.usage.cache_read_input_tokens}`
                : ""}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function CausalChainRow({
  chain,
}: {
  chain: {
    trigger?: string;
    sector?: string;
    sector_impact_pct?: number;
    stocks?: string[];
    portfolio_impact_pct?: number;
    narrative?: string;
  };
}) {
  return (
    <div className="rounded-lg border border-ink-600 bg-ink-900/60 p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {chain.trigger && <span className="text-neutral-200">{chain.trigger}</span>}
        {chain.sector && (
          <>
            <span className="text-neutral-500">→</span>
            <span className="pill bg-accent-blue/15 text-accent-blue">
              {chain.sector}
              {chain.sector_impact_pct !== undefined
                ? ` ${formatPct(chain.sector_impact_pct)}`
                : ""}
            </span>
          </>
        )}
        {chain.stocks && chain.stocks.length > 0 && (
          <>
            <span className="text-neutral-500">→</span>
            <span className="text-neutral-200">{chain.stocks.join(", ")}</span>
          </>
        )}
        {chain.portfolio_impact_pct !== undefined && (
          <>
            <span className="text-neutral-500">→</span>
            <span className={`font-mono ${pnlColor(chain.portfolio_impact_pct)}`}>
              portfolio {formatPct(chain.portfolio_impact_pct)}
            </span>
          </>
        )}
      </div>
      {chain.narrative && (
        <p className="mt-2 text-sm text-neutral-400">{chain.narrative}</p>
      )}
    </div>
  );
}
