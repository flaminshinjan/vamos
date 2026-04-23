"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AdvisorBriefing,
  EvaluationResult,
  MarketTrend,
  Portfolio,
  PortfolioAnalytics,
  RelevantNews,
} from "@/lib/api";
import {
  copyMarkdown,
  downloadMarkdown,
  threadToMarkdown,
} from "@/lib/export";
import { FOLLOWUPS, SUGGESTED_PROMPTS, classifyIntent, type Intent } from "@/lib/intent";
import { tryParsePartial } from "@/lib/partialJson";
import { readSSE } from "@/lib/sse";
import {
  deriveTitle,
  getThread,
  saveThread,
  type SerializedMsg,
  type Thread,
} from "@/lib/threads";
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

type Msg = SerializedMsg;

type Toast = { id: number; text: string; kind: "ok" | "warn" };

export function Chat({
  portfolio,
  portfolioId,
  trend,
  analytics,
  relevantNews,
  threadId,
  onThreadsChanged,
  onThreadSelected,
  theme,
  onToggleTheme,
}: {
  portfolio: Portfolio;
  portfolioId: string;
  trend: MarketTrend;
  analytics: PortfolioAnalytics;
  relevantNews: RelevantNews[];
  threadId: string | null;
  onThreadsChanged: () => void;
  onThreadSelected: (id: string | null) => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeThreadRef = useRef<Thread | null>(null);

  // Load messages when the threadId or portfolio changes
  useEffect(() => {
    if (threadId) {
      const t = getThread(threadId);
      if (t && t.portfolioId === portfolioId) {
        activeThreadRef.current = t;
        setMessages(t.messages);
        setTyping(false);
        return;
      }
    }
    // No thread or mismatched portfolio → empty state (welcome screen)
    activeThreadRef.current = null;
    setMessages([]);
    setTyping(false);
  }, [threadId, portfolioId]);

  // Autoscroll on new content
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, typing]);

  const toast = useCallback((text: string, kind: "ok" | "warn" = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((ts) => [...ts, { id, text, kind }]);
    setTimeout(() => {
      setToasts((ts) => ts.filter((t) => t.id !== id));
    }, 2400);
  }, []);

  // Persist the current message list into the active thread (or create one)
  const persist = useCallback(
    (msgs: Msg[]) => {
      if (msgs.length === 0) return;
      const now = Date.now();
      let t = activeThreadRef.current;
      if (!t) {
        const firstUser = msgs.find((m) => m.role === "user");
        if (!firstUser) return;
        t = {
          id: `t${now}`,
          portfolioId,
          title: deriveTitle((firstUser as { text: string }).text),
          createdAt: now,
          updatedAt: now,
          messages: msgs,
        };
        activeThreadRef.current = t;
        saveThread(t);
        onThreadSelected(t.id);
      } else {
        t.messages = msgs;
        t.updatedAt = now;
        saveThread(t);
      }
      onThreadsChanged();
    },
    [portfolioId, onThreadSelected, onThreadsChanged],
  );

  const push = useCallback(
    (msg: Msg) => {
      setMessages((m) => {
        const next = [...m, msg];
        // Persist on user messages and stable agent messages. Skip mid-stream
        // kinds (reasoning + streaming_briefing) to avoid thrashing
        // localStorage on every token; they'll be persisted on completion.
        const isMidStream =
          msg.role === "agent" &&
          (msg.kind === "reasoning" || msg.kind === "streaming_briefing");
        if (!isMidStream) {
          persist(next);
        }
        return next;
      });
    },
    [persist],
  );

  const updateReasoning = useCallback(
    (
      msgId: string,
      mutate: (r: Extract<Msg, { kind: "reasoning" }>) => Extract<Msg, { kind: "reasoning" }>,
    ) => {
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
        push({ id: `a${Date.now()}n`, role: "agent", kind: "news", news: relevantNews });
        await delay(80);
        push({ id: `a${Date.now()}f`, role: "agent", kind: "followups" });
        return;
      }

      // briefing + causal → stream
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

      // For briefing intent, a streaming card is pushed immediately when the
      // LLM starts emitting. For causal intent we only want the graph + trace.
      const briefingId = `a${Date.now()}-brief`;
      let briefingPushed = false;

      const updateStreaming = (
        mutate: (
          m: Extract<Msg, { kind: "streaming_briefing" }>,
        ) => Extract<Msg, { kind: "streaming_briefing" }>,
      ) => {
        setMessages((ms) =>
          ms.map((x) =>
            x.id === briefingId && x.role === "agent" && x.kind === "streaming_briefing"
              ? mutate(x)
              : x,
          ),
        );
      };

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

        let finalBriefing: AdvisorBriefing | null = null;
        let finalEval: EvaluationResult | null = null;
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
          } else if (frame.event === "start") {
            // LLM has begun emitting tokens — show the streaming card so the
            // user sees content arrive field-by-field instead of all at once.
            if (intent !== "causal" && !briefingPushed) {
              briefingPushed = true;
              push({
                id: briefingId,
                role: "agent",
                kind: "streaming_briefing",
                accumulated: "",
                partial: {},
                briefing: null,
                evaluation: null,
              });
            }
          } else if (frame.event === "delta") {
            const d = frame.data as { text?: string };
            if (intent === "causal" || !d.text) continue;
            if (!briefingPushed) {
              briefingPushed = true;
              push({
                id: briefingId,
                role: "agent",
                kind: "streaming_briefing",
                accumulated: "",
                partial: {},
                briefing: null,
                evaluation: null,
              });
            }
            updateStreaming((m) => {
              const nextAcc = m.accumulated + d.text!;
              const parsed =
                tryParsePartial<typeof m.partial>(nextAcc) ?? m.partial;
              return { ...m, accumulated: nextAcc, partial: parsed };
            });
          } else if (frame.event === "briefing") {
            finalBriefing = frame.data as AdvisorBriefing;
            if (intent !== "causal") {
              updateStreaming((m) => ({ ...m, briefing: finalBriefing }));
            }
          } else if (frame.event === "evaluation") {
            finalEval = frame.data as EvaluationResult;
            if (intent !== "causal") {
              updateStreaming((m) => ({ ...m, evaluation: finalEval }));
            }
          } else if (frame.event === "done") {
            const d = frame.data as {
              latency_ms?: number;
              usage?: Record<string, number>;
            };
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

        // Stream finished. Upgrade the streaming card to the clean final
        // briefing kind so persistence + export use the canonical shape.
        if (intent !== "causal" && finalBriefing) {
          setMessages((ms) =>
            ms.map((x) =>
              x.id === briefingId && x.role === "agent" && x.kind === "streaming_briefing"
                ? {
                    id: briefingId,
                    role: "agent" as const,
                    kind: "briefing" as const,
                    briefing: finalBriefing!,
                    evaluation: finalEval,
                  }
                : x,
            ),
          );
        }

        if (finalBriefing) {
          push({
            id: `a${Date.now()}g`,
            role: "agent",
            kind: "graph",
            briefing: finalBriefing,
            news: relevantNews,
          });
          push({ id: `a${Date.now()}f`, role: "agent", kind: "followups" });
        }

        // Persist final state
        setMessages((curr) => {
          persist(curr);
          return curr;
        });
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
    [portfolioId, trend, analytics, relevantNews, push, updateReasoning, persist],
  );

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!input.trim()) return;
    handlePrompt(input.trim());
    setInput("");
  }

  // ── Share / Export / menu actions ─────────────────────────────────
  const buildExportDoc = useCallback((): string | null => {
    const t = activeThreadRef.current;
    if (!t || t.messages.length === 0) return null;
    return threadToMarkdown(t, portfolio.user_name);
  }, [portfolio.user_name]);

  const onShare = useCallback(async () => {
    const md = buildExportDoc();
    if (!md) {
      toast("Nothing to share yet — ask me something first.", "warn");
      return;
    }
    const ok = await copyMarkdown(md);
    toast(
      ok ? "Conversation copied to clipboard as markdown." : "Couldn't access clipboard.",
      ok ? "ok" : "warn",
    );
  }, [buildExportDoc, toast]);

  const onExport = useCallback(() => {
    const md = buildExportDoc();
    if (!md) {
      toast("Nothing to export yet.", "warn");
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    const slug = portfolio.user_name.toLowerCase().replace(/\s+/g, "-");
    downloadMarkdown(`vamos-briefing-${slug}-${stamp}.md`, md);
    toast("Briefing downloaded.", "ok");
  }, [buildExportDoc, portfolio.user_name, toast]);

  const onClearConversation = useCallback(() => {
    setMessages([]);
    setTyping(false);
    activeThreadRef.current = null;
    onThreadSelected(null);
    setMenuOpen(false);
    toast("Conversation cleared.", "ok");
  }, [onThreadSelected, toast]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    const timer = setTimeout(() => document.addEventListener("click", close), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", close);
    };
  }, [menuOpen]);

  const showWelcome = messages.length === 0 && !typing;

  return (
    <section className="chat">
      <div className="chat-header">
        <div className="chat-title">
          <span className="dot accent pulse" />
          <span>{activeThreadRef.current?.title ?? "Briefing session"}</span>
          <span className="dim">· {portfolio.user_name}</span>
        </div>
        <div
          style={{
            display: "flex",
            gap: 6,
            fontSize: 12,
            color: "var(--ink-3)",
            alignItems: "center",
          }}
        >
          <button
            className="tool-btn"
            onClick={onToggleTheme}
            title={theme === "dark" ? "Switch to light" : "Switch to dark"}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.4" />
                <path
                  d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M13 3l-1.4 1.4M4.4 11.6L3 13"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path
                  d="M13 9.5A5 5 0 018 14a5 5 0 01-3.5-8.5A5 5 0 008 14a5 5 0 005-4.5z"
                  fill="currentColor"
                />
              </svg>
            )}
            <span style={{ marginLeft: 4 }}>{theme === "dark" ? "Light" : "Dark"}</span>
          </button>
          <button className="tool-btn" onClick={onShare} title="Copy conversation">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <circle cx="12" cy="4" r="2" stroke="currentColor" strokeWidth="1.3" />
              <circle cx="4" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" />
              <circle cx="12" cy="12" r="2" stroke="currentColor" strokeWidth="1.3" />
              <path
                d="M6 7l4-2M6 9l4 2"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
            Share
          </button>
          <button className="tool-btn" onClick={onExport} title="Download as markdown">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 2v9M4.5 7.5L8 11l3.5-3.5"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M3 13h10"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
            Export
          </button>
          <div style={{ position: "relative" }}>
            <button
              className="tool-btn"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((o) => !o);
              }}
              aria-label="More actions"
            >
              ⋯
            </button>
            {menuOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: "absolute",
                  top: "100%",
                  right: 0,
                  marginTop: 6,
                  minWidth: 180,
                  background: "var(--bg-elev)",
                  border: "1px solid var(--line)",
                  borderRadius: 8,
                  boxShadow: "var(--shadow-lg)",
                  padding: 4,
                  zIndex: 50,
                }}
              >
                <button
                  className="tool-btn"
                  style={{ width: "100%", justifyContent: "flex-start" }}
                  onClick={onClearConversation}
                >
                  Clear conversation
                </button>
                <button
                  className="tool-btn"
                  style={{ width: "100%", justifyContent: "flex-start" }}
                  onClick={() => {
                    onShare();
                    setMenuOpen(false);
                  }}
                >
                  Copy as markdown
                </button>
                <button
                  className="tool-btn"
                  style={{ width: "100%", justifyContent: "flex-start" }}
                  onClick={() => {
                    onExport();
                    setMenuOpen(false);
                  }}
                >
                  Download .md
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="chat-scroll" ref={scrollRef}>
        <div className="chat-inner">
          {showWelcome && <Welcome portfolio={portfolio} onPrompt={handlePrompt} />}
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
              <button
                type="button"
                className="tool-btn"
                onClick={onClearConversation}
                title="Start a fresh thread"
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M8 3v10M3 8h10"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
                New
              </button>
              <span
                className="tool-btn"
                style={{ cursor: "default" }}
                title="Active portfolio"
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="2" fill="currentColor" />
                </svg>
                {portfolio.user_name.split(" ")[0]}
              </span>
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

      <Toasts toasts={toasts} />
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
        Good evening. Ask me <em style={{ color: "var(--accent)" }}>why</em>,
        <br />
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
  if (msg.kind === "graph") return <GraphWrapper briefing={msg.briefing} news={msg.news} />;
  if (msg.kind === "briefing")
    return <BriefingCard briefing={msg.briefing} evaluation={msg.evaluation} />;
  if (msg.kind === "streaming_briefing") {
    // If the final briefing already arrived (stream completed), render the
    // full card with evaluation. Otherwise show the partial data as it grows.
    if (msg.briefing) {
      return <BriefingCard briefing={msg.briefing} evaluation={msg.evaluation} />;
    }
    return <BriefingCard briefing={msg.partial} evaluation={null} streaming />;
  }
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

function GraphWrapper({
  briefing,
  news,
}: {
  briefing: AdvisorBriefing;
  news: RelevantNews[];
}) {
  const portfolio: Portfolio = useMemo(
    () => ({
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
    }),
    [briefing],
  );
  return <CausalGraphCard briefing={briefing} portfolio={portfolio} topNews={news} />;
}

function Toasts({ toasts }: { toasts: Toast[] }) {
  if (toasts.length === 0) return null;
  return (
    <div
      style={{
        position: "fixed",
        bottom: 32,
        right: 32,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        zIndex: 100,
        pointerEvents: "none",
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="fade-up"
          style={{
            padding: "10px 14px",
            background: t.kind === "warn" ? "var(--neg-soft)" : "var(--ink)",
            color: t.kind === "warn" ? "var(--neg)" : "var(--bg)",
            border:
              t.kind === "warn"
                ? "1px solid var(--neg)"
                : "1px solid var(--ink-2)",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 500,
            boxShadow: "var(--shadow-lg)",
            maxWidth: 360,
          }}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}

function sectorLabel(s: string): string {
  return s
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
