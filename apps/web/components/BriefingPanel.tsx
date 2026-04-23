"use client";

import { useState } from "react";
import { type AdvisorBriefing } from "@/lib/api";
import { formatPct, pnlColor, severityClasses } from "@/lib/format";

export function BriefingPanel({
  portfolioId,
}: {
  portfolioId: string;
}) {
  const [briefing, setBriefing] = useState<AdvisorBriefing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    setBriefing(null);
    try {
      const res = await fetch(`/api/brief`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ portfolio_id: portfolioId }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text.slice(0, 300)}`);
      }
      const data: AdvisorBriefing = await res.json();
      setBriefing(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Agent briefing</h3>
          <p className="text-xs text-neutral-500">
            News → Sector → Stock → Portfolio · Claude Sonnet 4.6 · self-evaluated
          </p>
        </div>
        <button
          onClick={run}
          disabled={loading}
          className="rounded-lg bg-accent-blue px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
        >
          {loading ? "Reasoning…" : briefing ? "Re-run" : "Generate briefing"}
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-accent-red/30 bg-accent-red/10 p-3 text-sm text-accent-red">
          {error}
        </div>
      )}

      {loading && !briefing && (
        <div className="mt-6 space-y-3">
          <div className="h-4 w-2/3 animate-pulse rounded bg-ink-700" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-ink-700" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-ink-700" />
          <div className="h-24 w-full animate-pulse rounded bg-ink-700" />
          <div className="text-xs text-neutral-500">
            Running analytics, ranking news, calling Claude, evaluating…
          </div>
        </div>
      )}

      {briefing && <BriefingView briefing={briefing} />}
    </section>
  );
}

function BriefingView({ briefing }: { briefing: AdvisorBriefing }) {
  return (
    <div className="mt-5 space-y-6">
      <div>
        <h4 className="text-xl font-semibold">{briefing.headline}</h4>
        <p className="mt-2 text-neutral-300">{briefing.summary}</p>
      </div>

      {briefing.causal_chains.length > 0 && (
        <div>
          <div className="label mb-2">Causal chains</div>
          <div className="space-y-3">
            {briefing.causal_chains.map((c, i) => (
              <div key={i} className="rounded-lg border border-ink-600 bg-ink-900/60 p-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-neutral-200">{c.trigger}</span>
                  <span className="text-neutral-500">→</span>
                  <span className="pill bg-accent-blue/15 text-accent-blue">
                    {c.sector} {formatPct(c.sector_impact_pct)}
                  </span>
                  {c.stocks.length > 0 && (
                    <>
                      <span className="text-neutral-500">→</span>
                      <span className="text-neutral-200">{c.stocks.join(", ")}</span>
                    </>
                  )}
                  <span className="text-neutral-500">→</span>
                  <span className={`font-mono ${pnlColor(c.portfolio_impact_pct)}`}>
                    portfolio {formatPct(c.portfolio_impact_pct)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-neutral-400">{c.narrative}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {briefing.key_insights.length > 0 && (
        <div>
          <div className="label mb-2">Key insights</div>
          <div className="space-y-2">
            {briefing.key_insights.map((i, idx) => {
              const cls = severityClasses(i.severity);
              return (
                <div
                  key={idx}
                  className={`rounded-lg bg-ink-900/60 p-3 ${cls.border}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`pill ${cls.pill}`}>{i.severity}</span>
                    <span className="font-medium text-neutral-100">{i.title}</span>
                  </div>
                  <p className="mt-1 text-sm text-neutral-300">{i.detail}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {briefing.conflicts.length > 0 && (
        <div>
          <div className="label mb-2">Conflicting signals</div>
          <div className="space-y-2">
            {briefing.conflicts.map((c, i) => (
              <div key={i} className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
                <div className="font-medium text-amber-300">{c.stock_or_sector}</div>
                <div className="mt-1 text-neutral-400">
                  news: <span className="text-neutral-200">{c.news_signal}</span>
                </div>
                <div className="text-neutral-400">
                  price: <span className="text-neutral-200">{c.price_signal}</span>
                </div>
                <div className="mt-1 text-neutral-300">→ {c.explanation}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {briefing.recommendations.length > 0 && (
        <div>
          <div className="label mb-2">Recommendations</div>
          <ul className="list-inside list-disc space-y-1 text-sm text-neutral-300">
            {briefing.recommendations.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 rounded-lg border border-ink-600 bg-ink-900/40 p-4 sm:grid-cols-2">
        <div>
          <div className="label">Confidence</div>
          <div className="mt-1 flex items-center gap-3">
            <div className="text-3xl font-semibold">
              {(briefing.confidence * 100).toFixed(0)}%
            </div>
            <div className="h-2 flex-1 overflow-hidden rounded bg-ink-700">
              <div
                className="h-full bg-accent-blue"
                style={{ width: `${briefing.confidence * 100}%` }}
              />
            </div>
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            {briefing.confidence_rationale}
          </p>
        </div>
        {briefing.evaluation && (
          <div>
            <div className="label">Self-evaluation</div>
            <div className="mt-1 flex items-center gap-3">
              <div className="text-3xl font-semibold">
                {(briefing.evaluation.score * 100).toFixed(0)}%
              </div>
              <span className="pill bg-ink-700 text-neutral-300">
                {briefing.evaluation.causal_depth}
              </span>
              <span className="pill bg-ink-700 text-neutral-400">
                {briefing.evaluation.method}
              </span>
            </div>
            <p className="mt-2 text-xs text-neutral-500">
              {briefing.evaluation.rationale}
            </p>
            {briefing.evaluation.missing_elements.length > 0 && (
              <p className="mt-1 text-xs text-neutral-500">
                Missing: {briefing.evaluation.missing_elements.slice(0, 3).join("; ")}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="text-xs text-neutral-500">
        {briefing.latency_ms && <span>Latency {briefing.latency_ms}ms · </span>}
        {briefing.token_usage && (
          <span>
            Tokens: in {briefing.token_usage.input_tokens ?? 0} · out{" "}
            {briefing.token_usage.output_tokens ?? 0}
            {briefing.token_usage.cache_read_input_tokens
              ? ` · cached ${briefing.token_usage.cache_read_input_tokens}`
              : ""}{" "}
            ·{" "}
          </span>
        )}
        {briefing.trace_id && <span>Trace {briefing.trace_id.slice(0, 8)}</span>}
      </div>
    </div>
  );
}
