"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AdvisorBriefing,
  EvaluationResult,
  MarketTrend,
  Portfolio,
  PortfolioAnalytics,
  RelevantNews,
} from "@/lib/api";
import { FOLLOWUPS, SUGGESTED_PROMPTS, classifyIntent, type Intent } from "@/lib/intent";
import { readSSE } from "@/lib/sse";
import { BriefingCard } from "@/components/cards/BriefingCard";
import { CausalGraphCard } from "@/components/cards/CausalGraphCard";
import { MarketSnapshotCard } from "@/components/cards/MarketSnapshotCard";
import { NewsCard } from "@/components/cards/NewsCard";
import {
  DEFAULT_STEPS,
  ReasoningTraceCard,
  type ToolCallStep,
} from "@/components/cards/ReasoningTraceCard";
import { RiskCard } from "@/components/cards/RiskCard";

// Message types — the chat's source of truth
type Msg =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "agent"; kind: "text"; text: string }
  | { id: string; role: "agent"; kind: "followups" }
  | { id: string; role: "agent"; kind: "market"; trend: MarketTrend }
  | { id: string; role: "agent"; kind: "news"; news: RelevantNews[] }
  | { id: string; role: "agent"; kind: "risk"; analytics: PortfolioAnalytics }
  | {
      id: string;
      role: "agent";
      kind: "reasoning";
      steps: ToolCallStep[];
      tokenUsage?: Record<string, number>;
      totalMs?: number;
    }
  | {
      id: string;
      role: "agent";
      kind: "graph";
      briefing: AdvisorBriefing;
      news: RelevantNews[];
    }
  | {
      id: string;
      role: "agent";
      kind: "briefing";
      briefing: AdvisorBriefing;
      evaluation: EvaluationResult | null;
    };

export function Chat({
  portfolio,
  portfolioId,
  trend,
  analytics,
  relevantNews,
}: {
  portfolio: Portfolio;
  portfolioId: string;
  trend: MarketTrend;
  analytics: PortfolioAnalytics;
  relevantNews: RelevantNews[];
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset when portfolio switches
  useEffect(() => {
    setMessages([]);
    setTyping(false);
  }, [portfolioId]);

  // Autoscroll on new content
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, typing]);

  const push = useCallback((msg: Msg) => {
    setMessages((m) => [...m, msg]);
  }, []);

  const updateReasoning = useCallback(
    (msgId: string, mutate: (r: Extract<Msg, { kind: "reasoning" }>) => Extract<Msg, { kind: "reasoning" }>) => {
      setMessages((m) =>
        m.map((x) =>
          x.id === msgId && x.role === "agent" && x.kind === "reasoning"
            ? mutate(x)
            : x,
        ),
      );
    },
    [],
  );

  const handlePrompt = useCallback(
    async (text: string, explicitIntent?: Intent) => {
      const intent = explicitIntent ?? classifyIntent(text);
      push({ id: `u${Date.now()}`, role: "user", text });
      setTyping(true);

      // Lightweight, instant responses for non-LLM intents (~100ms)
      if (intent === "market") {
        await delay(280);
        setTyping(false);
        push({
          id: `a${Date.now()}t`,
          role: "agent",
          kind: "text",
          text: `Here's today's market picture. ${trend.advancing_sectors} sectors advanced and ${trend.declining_sectors} declined — the tone is ${trend.overall_sentiment.toLowerCase()}.`,
        });
        await delay(120);
        push({ id: `a${Date.now()}c`, role: "agent", kind: "market", trend });
        await delay(80);
        push({ id: `a${Date.now()}f`, role: "agent", kind: "followups" });
        return;
      }

      if (intent === "risk") {
        await delay(280);
        setTyping(false);
        const topSector = Object.entries(analytics.sector_allocation)
          .filter(([k]) => k !== "DIVERSIFIED_MF")
          .sort(([, a], [, b]) => b - a)[0];
        const [name, weight] = topSector ?? ["—", 0];
        const msg = analytics.concentration_risk
          ? `I've flagged a concentration risk. ${sectorLabel(name)} accounts for ${weight.toFixed(1)}% of your book — above the 40% threshold.`
          : `Your portfolio looks well balanced. The largest sector (${sectorLabel(name)}) sits at ${weight.toFixed(1)}%, comfortably below the 40% concentration threshold.`;
        push({ id: `a${Date.now()}t`, role: "agent", kind: "text", text: msg });
        await delay(120);
        push({ id: `a${Date.now()}r`, role: "agent", kind: "risk", analytics });
        await delay(80);
        push({ id: `a${Date.now()}f`, role: "agent", kind: "followups" });
        return;
      }

      if (intent === "news") {
        await delay(280);
        setTyping(false);
        push({
          id: `a${Date.now()}t`,
          role: "agent",
          kind: "text",
          text: `I classified ${relevantNews.length} headlines that matter for your book. Each is tagged by sentiment, scope, and an impact score I use to prioritize signal over noise.`,
        });
        await delay(120);
        push({
          id: `a${Date.now()}n`,
          role: "agent",
          kind: "news",
          news: relevantNews,
        });
        await delay(80);
        push({ id: `a${Date.now()}f`, role: "agent", kind: "followups" });
        return;
      }

      // briefing + causal → stream the full pipeline
      await delay(220);
      setTyping(false);
      push({
        id: `a${Date.now()}t`,
        role: "agent",
        kind: "text",
        text:
          intent === "causal"
            ? "Let me trace the causal chain. I'll only show paths above impact 0.50."
            : "Let me reason through this. I'll pull market context, classify today's news, link it to your holdings, and grade my own output.",
      });

      const reasoningId = `a${Date.now()}-reason`;
      push({
        id: reasoningId,
        role: "agent",
        kind: "reasoning",
        steps: DEFAULT_STEPS.map((s) => ({ ...s })),
      });

      // Hit the streaming endpoint
      try {
        const res = await fetch("/api/brief/stream", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            portfolio_id: portfolioId,
            top_news: 8,
            skip_evaluation: intent === "causal",
          }),
        });
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

        let briefing: AdvisorBriefing | null = null;
        let evaluation: EvaluationResult | null = null;
        const t0 = performance.now();

        for await (const frame of readSSE(res)) {
          if (frame.event === "tool_call") {
            const d = frame.data as {
              id: string;
              status: "active" | "done";
              duration_ms?: number;
            };
            updateReasoning(reasoningId, (r) => ({
              ...r,
              steps: r.steps.map((s) =>
                s.id === d.id
                  ? {
                      ...s,
                      status: d.status === "active" ? "active" : "done",
                      duration_ms: d.duration_ms ?? s.duration_ms,
                    }
                  : s,
              ),
            }));
          } else if (frame.event === "briefing") {
            briefing = frame.data as AdvisorBriefing;
          } else if (frame.event === "evaluation") {
            evaluation = frame.data as EvaluationResult;
          } else if (frame.event === "done") {
            const d = frame.data as { latency_ms?: number; usage?: Record<string, number> };
            updateReasoning(reasoningId, (r) => ({
              ...r,
              tokenUsage: d.usage,
              totalMs: d.latency_ms ?? Math.round(performance.now() - t0),
            }));
          } else if (frame.event === "error") {
            const e = frame.data as { error: string };
            push({
              id: `a${Date.now()}e`,
              role: "agent",
              kind: "text",
              text: `I hit an error: ${e.error}`,
            });
            return;
          }
        }

        if (briefing) {
          if (intent === "causal") {
            push({
              id: `a${Date.now()}g`,
              role: "agent",
              kind: "graph",
              briefing,
              news: relevantNews,
            });
          } else {
            push({
              id: `a${Date.now()}g`,
              role: "agent",
              kind: "graph",
              briefing,
              news: relevantNews,
            });
            push({
              id: `a${Date.now()}b`,
              role: "agent",
              kind: "briefing",
              briefing,
              evaluation,
            });
          }
          push({ id: `a${Date.now()}f`, role: "agent", kind: "followups" });
        }
      } catch (err) {
        push({
          id: `a${Date.now()}e`,
          role: "agent",
          kind: "text",
          text: `Couldn't reach the reasoner: ${
            err instanceof Error ? err.message : String(err)
          }`,
        });
      }
    },
    [portfolioId, trend, analytics, relevantNews, push, updateReasoning],
  );

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!input.trim()) return;
    handlePrompt(input.trim());
    setInput("");
  }

  return (
    <section className="chat">
      <div className="chat-header">
        <div className="chat-title">
          <span className="dot accent pulse" />
          <span>Briefing session</span>
          <span className="dim">· {portfolio.user_name}</span>
        </div>
        <div style={{ display: "flex", gap: 6, fontSize: 12, color: "var(--ink-3)" }}>
          <button className="tool-btn">Share</button>
          <button className="tool-btn">Export</button>
          <button className="tool-btn">⋯</button>
        </div>
      </div>

      <div className="chat-scroll" ref={scrollRef}>
        <div className="chat-inner">
          {messages.length === 0 && (
            <Welcome portfolio={portfolio} onPrompt={handlePrompt} />
          )}
          {messages.map((m) =>
            m.role === "user" ? (
              <UserMessage key={m.id} text={m.text} />
            ) : (
              <AgentMessage key={m.id}>
                <AgentBody msg={m} onPrompt={handlePrompt} />
              </AgentMessage>
            ),
          )}
          {typing && <TypingMessage />}
        </div>
      </div>

      <div className="composer-wrap">
        <form className="composer" onSubmit={submit}>
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) submit(e as React.FormEvent);
            }}
            placeholder="Ask about news, sectors, holdings, or risks…"
          />
          <div className="composer-foot">
            <div className="composer-tools">
              <button type="button" className="tool-btn" title="Attach news">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M10 3.5v5a2 2 0 01-4 0V4a1.5 1.5 0 013 0v4.5"
                    stroke="currentColor"
                    strokeWidth="1.3"
                  />
                </svg>
                Attach
              </button>
              <button type="button" className="tool-btn" title="Active portfolio">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M3 5l3-3 3 3M13 11l-3 3-3-3"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                  />
                </svg>
                {portfolio.user_name.split(" ")[0]}
              </button>
            </div>
            <button type="submit" className="send-btn" disabled={!input.trim()}>
              Send
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path
                  d="M3 8h10M9 4l4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

function Welcome({
  portfolio,
  onPrompt,
}: {
  portfolio: Portfolio;
  onPrompt: (text: string, intent?: Intent) => void;
}) {
  return (
    <div className="fade-up" style={{ paddingTop: 40, paddingBottom: 24 }}>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "5px 12px",
          background: "var(--accent-soft)",
          color: "var(--accent)",
          borderRadius: 999,
          fontSize: 11.5,
          fontWeight: 500,
          marginBottom: 20,
        }}
      >
        <span className="dot pulse" style={{ background: "var(--accent)" }} />
        Connected · {portfolio.user_name.split(" ")[0]}&apos;s portfolio · NSE close
      </div>
      <h1
        className="serif"
        style={{
          fontSize: 46,
          lineHeight: 1.05,
          letterSpacing: "-0.02em",
          margin: "0 0 14px",
          maxWidth: 620,
        }}
      >
        Good evening. Ask me{" "}
        <em style={{ color: "var(--accent)" }}>why</em>,<br />
        not just <span style={{ color: "var(--ink-3)" }}>how much</span>.
      </h1>
      <p
        style={{
          fontSize: 15,
          color: "var(--ink-2)",
          maxWidth: 540,
          lineHeight: 1.55,
          margin: "0 0 22px",
        }}
      >
        I reason through today&apos;s news, map it to sectors you hold, and
        explain exactly how the causal chain reached your portfolio — with
        sources and a confidence score.
      </p>
      <div className="chips">
        {SUGGESTED_PROMPTS.map((p) => (
          <button
            key={p.intent}
            className="chip"
            onClick={() => onPrompt(p.text, p.intent)}
          >
            <span className="mono">{p.icon}</span>
            {p.text}
          </button>
        ))}
      </div>
    </div>
  );
}

function UserMessage({ text }: { text: string }) {
  return (
    <div className="msg">
      <div className="msg-row">
        <div className="msg-avatar user">R</div>
        <div className="msg-body">
          <div className="msg-who">You</div>
          <div className="msg-content">{text}</div>
        </div>
      </div>
    </div>
  );
}

function AgentMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="msg">
      <div className="msg-row">
        <div className="msg-avatar agent">A</div>
        <div className="msg-body">
          <div className="msg-who">
            Aarthik
            <span className="meta-lite">· sonnet-4.6 · traced</span>
          </div>
          <div className="msg-content">{children}</div>
        </div>
      </div>
    </div>
  );
}

function TypingMessage() {
  return (
    <div className="msg fade-in">
      <div className="msg-row">
        <div className="msg-avatar agent">A</div>
        <div className="msg-body" style={{ paddingTop: 6 }}>
          <div className="typing-indicator">
            <span />
            <span />
            <span />
          </div>
        </div>
      </div>
    </div>
  );
}

function AgentBody({
  msg,
  onPrompt,
}: {
  msg: Extract<Msg, { role: "agent" }>;
  onPrompt: (text: string, intent?: Intent) => void;
}) {
  if (msg.kind === "text") return <p>{msg.text}</p>;
  if (msg.kind === "market") return <MarketSnapshotCard trend={msg.trend} />;
  if (msg.kind === "news") return <NewsCard news={msg.news} />;
  if (msg.kind === "risk") return <RiskCard analytics={msg.analytics} />;
  if (msg.kind === "reasoning")
    return (
      <ReasoningTraceCard
        steps={msg.steps}
        tokenUsage={msg.tokenUsage}
        totalMs={msg.totalMs}
      />
    );
  if (msg.kind === "graph") {
    // Need portfolio here — we don't have it in msg, but it's closed over in Chat
    // Can't cleanly pass it through; use a context-free alternative — but the
    // BriefingCard itself embeds the analytics. We show graph with portfolio
    // passed via closure through a wrapper component below.
    return <GraphWrapper briefing={msg.briefing} news={msg.news} />;
  }
  if (msg.kind === "briefing")
    return <BriefingCard briefing={msg.briefing} evaluation={msg.evaluation} />;
  if (msg.kind === "followups")
    return (
      <div className="chips" style={{ marginTop: 4 }}>
        {FOLLOWUPS.map((f, i) => (
          <button key={i} className="chip" onClick={() => onPrompt(f.text, f.intent)}>
            <span className="mono">→</span>
            {f.text}
          </button>
        ))}
      </div>
    );
  return null;
}

// Small wrapper — we need portfolio for the graph. We grab it from the
// nearest data source via props drilling in the parent. Using a ref to Chat's
// portfolio prop via React context would be cleaner; keep this simple.
function GraphWrapper({
  briefing,
  news,
}: {
  briefing: AdvisorBriefing;
  news: RelevantNews[];
}) {
  // Build a minimal portfolio object the graph needs — just held stock symbols
  const portfolio: Portfolio = {
    portfolio_id: briefing.portfolio_id,
    user_name: briefing.user_name,
    portfolio_type: "",
    risk_profile: "",
    investment_horizon: "",
    description: "",
    total_investment: 0,
    current_value: briefing.portfolio_analytics.current_value,
    overall_gain_loss: 0,
    overall_gain_loss_percent: 0,
    holdings: {
      stocks: briefing.causal_chains.flatMap((c) =>
        c.stocks.map((s) => ({
          symbol: s,
          name: s,
          sector: c.sector,
          quantity: 0,
          current_price: 0,
          current_value: 0,
          gain_loss_percent: 0,
          day_change_percent: c.portfolio_impact_pct,
          weight_in_portfolio: 0,
        })),
      ),
      mutual_funds: [],
    },
  };
  return <CausalGraphCard briefing={briefing} portfolio={portfolio} topNews={news} />;
}

// Helpers
function sectorLabel(s: string): string {
  return s
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
