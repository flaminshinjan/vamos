"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AdvisorBriefing,
  EvaluationResult,
  HoldingsPayload,
  LiveMarketPayload,
  MarketForecast,
  MarketTrend,
  MutualFundsPayload,
  NoteTone,
  Portfolio,
  PortfolioAnalytics,
  RelevantNews,
  SectorPerformancePayload,
  StockDiagnosis,
  StockQuote,
  TrendScanPayload,
} from "@/lib/api";
import {
  copyMarkdown,
  downloadMarkdown,
  threadToMarkdown,
} from "@/lib/export";
import { SUGGESTED_PROMPTS, type Intent } from "@/lib/intent";
import { tryParsePartial } from "@/lib/partialJson";
import { readSSE } from "@/lib/sse";
import {
  deriveTitle,
  getThread,
  saveThread,
  type SerializedMsg,
  type Thread,
} from "@/lib/threads";
import { Markdown } from "@/components/Markdown";
import { BriefingCard } from "@/components/cards/BriefingCard";
import { CausalGraphCard } from "@/components/cards/CausalGraphCard";
import { ForecastCard } from "@/components/cards/ForecastCard";
import { HoldingsCard } from "@/components/cards/HoldingsCard";
import { LiveMarketCard } from "@/components/cards/LiveMarketCard";
import { MarketSnapshotCard } from "@/components/cards/MarketSnapshotCard";
import { MutualFundsCard } from "@/components/cards/MutualFundsCard";
import { NewsCard } from "@/components/cards/NewsCard";
import { NoteCard } from "@/components/cards/NoteCard";
import {
  DEFAULT_STEPS,
  ReasoningTraceCard,
  type ToolCallStep,
} from "@/components/cards/ReasoningTraceCard";
import { RiskCard } from "@/components/cards/RiskCard";
import { SectorPerformanceCard } from "@/components/cards/SectorPerformanceCard";
import { StockCard } from "@/components/cards/StockCard";
import { StockDiagnosisCard } from "@/components/cards/StockDiagnosisCard";
import { TrendScanCard } from "@/components/cards/TrendScanCard";

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

  // Load messages when thread or portfolio changes
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
    activeThreadRef.current = null;
    setMessages([]);
    setTyping(false);
  }, [threadId, portfolioId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, typing]);

  const toast = useCallback((text: string, kind: "ok" | "warn" = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((ts) => [...ts, { id, text, kind }]);
    setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), 2400);
  }, []);

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
        const isMidStream =
          msg.role === "agent" &&
          (msg.kind === "reasoning" ||
            msg.kind === "streaming_briefing" ||
            msg.kind === "text");
        // Stream-text messages get persisted when they finish (via finalizeText),
        // not on every token.
        if (!isMidStream) persist(next);
        return next;
      });
    },
    [persist],
  );

  type AgentMsg = Extract<Msg, { role: "agent" }>;
  type AgentKind = AgentMsg["kind"];

  const updateById = useCallback(
    <K extends AgentKind>(
      id: string,
      kind: K,
      mutate: (m: Extract<AgentMsg, { kind: K }>) => Extract<AgentMsg, { kind: K }>,
    ) => {
      setMessages((ms) =>
        ms.map((x) => {
          if (x.id !== id || x.role !== "agent") return x;
          if ((x as AgentMsg).kind !== kind) return x;
          return mutate(x as Extract<AgentMsg, { kind: K }>) as Msg;
        }),
      );
    },
    [],
  );

  // Throttled typewriter: chunks accumulate in a buffer and flush on a fixed
  // cadence so React doesn't re-render on every micro-token. ~30ms tick gives
  // a paced reveal without dropping fidelity.
  const textBufferRef = useRef<{ id: string; pending: string; timer: number | null }>({
    id: "",
    pending: "",
    timer: null,
  });

  const flushTextBuffer = useCallback(() => {
    const buf = textBufferRef.current;
    if (!buf.id || !buf.pending) {
      buf.timer = null;
      return;
    }
    const id = buf.id;
    const chunk = buf.pending;
    buf.pending = "";
    buf.timer = null;
    setMessages((ms) =>
      ms.map((x) =>
        x.id === id && x.role === "agent" && x.kind === "text"
          ? { ...x, text: x.text + chunk }
          : x,
      ),
    );
  }, []);

  const appendText = useCallback(
    (id: string, chunk: string) => {
      const buf = textBufferRef.current;
      // Switching ids: flush whatever's pending immediately under the old id.
      if (buf.id && buf.id !== id && buf.pending) {
        const prev = buf.pending;
        const prevId = buf.id;
        buf.pending = "";
        setMessages((ms) =>
          ms.map((x) =>
            x.id === prevId && x.role === "agent" && x.kind === "text"
              ? { ...x, text: x.text + prev }
              : x,
          ),
        );
      }
      buf.id = id;
      buf.pending += chunk;
      if (buf.timer == null) {
        buf.timer = window.setTimeout(flushTextBuffer, 30);
      }
    },
    [flushTextBuffer],
  );

  // Force-flush on unmount so trailing text isn't dropped.
  useEffect(() => {
    return () => {
      const buf = textBufferRef.current;
      if (buf.timer != null) {
        window.clearTimeout(buf.timer);
        buf.timer = null;
      }
    };
  }, []);

  const handlePrompt = useCallback(
    async (userText: string, _intent?: Intent) => {
      push({ id: `u${Date.now()}`, role: "user", text: userText });
      setTyping(true);

      // Single streaming text bubble for Claude's reply
      const replyId = `a${Date.now()}-reply`;
      let replyStarted = false;

      // Reasoning card — populated by workflow tool_call events. Seeded with
      // DEFAULT_STEPS only when produce_briefing is the active chat tool, so
      // the briefing pipeline shows its 5-step preview up front.
      const reasoningId = `a${Date.now()}-reasoning`;
      let reasoningPushed = false;
      let activeChatTool: string | null = null;

      // Streaming briefing card
      const briefingId = `a${Date.now()}-brief`;
      let briefingPushed = false;

      // Build history from current messages (user + assistant text only)
      const history = (() => {
        const out: Array<{ role: string; content: string }> = [];
        for (const m of messages) {
          if (m.role === "user") out.push({ role: "user", content: m.text });
          else if (m.role === "agent" && m.kind === "text") {
            out.push({ role: "assistant", content: m.text });
          }
        }
        return out;
      })();

      try {
        const res = await fetch("/api/chat/stream", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            portfolio_id: portfolioId,
            message: userText,
            history,
          }),
        });
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

        const t0 = performance.now();
        let finalBriefing: AdvisorBriefing | null = null;
        let finalEval: EvaluationResult | null = null;

        for await (const frame of readSSE(res)) {
          if (frame.event === "text_delta") {
            const d = frame.data as { text: string };
            if (!replyStarted) {
              replyStarted = true;
              setTyping(false);
              push({ id: replyId, role: "agent", kind: "text", text: "" });
            }
            appendText(replyId, d.text);
          } else if (frame.event === "tool_call") {
            const d = frame.data as {
              name?: string;
              label?: string;
              detail?: string;
              status?: "active" | "done";
              id?: string;
              duration_ms?: number;
            };

            // Chat-level events carry `name` (the tool Claude picked).
            // Workflow steps carry `label` + `detail` instead.
            if (d.name) {
              if (d.status === "active") activeChatTool = d.name;
              continue;
            }
            // Workflow step → populate the reasoning card.
            if (!reasoningPushed) {
              reasoningPushed = true;
              const seed: ToolCallStep[] =
                activeChatTool === "produce_briefing"
                  ? DEFAULT_STEPS.map((s) => ({ ...s }))
                  : [];
              push({
                id: reasoningId,
                role: "agent",
                kind: "reasoning",
                steps: seed,
              });
            }
            if (d.id && d.status) {
              updateById(reasoningId, "reasoning", (r) => {
                const idx = r.steps.findIndex((s) => s.id === d.id);
                const nextStatus = d.status === "active" ? "active" : "done";
                if (idx === -1) {
                  return {
                    ...r,
                    steps: [
                      ...r.steps,
                      {
                        id: d.id!,
                        label: d.label ?? d.id!,
                        detail: d.detail ?? "",
                        status: nextStatus,
                        duration_ms: d.duration_ms,
                      },
                    ],
                  };
                }
                return {
                  ...r,
                  steps: r.steps.map((s, i) =>
                    i === idx
                      ? {
                          ...s,
                          status: nextStatus,
                          label: d.label ?? s.label,
                          detail: d.detail ?? s.detail,
                          duration_ms: d.duration_ms ?? s.duration_ms,
                        }
                      : s,
                  ),
                };
              });
            }
          } else if (frame.event === "card") {
            const d = frame.data as {
              kind: string;
              trend?: MarketTrend;
              news?: RelevantNews[];
              analytics?: PortfolioAnalytics;
              quote?: StockQuote;
              summary?: string;
              diagnosis?: StockDiagnosis;
              forecast?: MarketForecast;
              sector?: SectorPerformancePayload;
              scan?: TrendScanPayload;
              holdings?: HoldingsPayload["holdings"];
              top_gainer?: HoldingsPayload["top_gainer"];
              top_loser?: HoldingsPayload["top_loser"];
              day_change_pct?: number;
              text?: string;
              tone?: NoteTone;
              funds?: MutualFundsPayload["funds"];
              weighted_day_change_pct?: number;
              indices?: LiveMarketPayload["indices"];
              avg_change_pct?: number;
              sentiment?: LiveMarketPayload["sentiment"];
              focus?: string;
              lead?: string;
            };
            if (d.kind === "market" && d.trend) {
              push({
                id: `a${Date.now()}-m`,
                role: "agent",
                kind: "market",
                trend: d.trend,
              });
            } else if (d.kind === "news" && d.news) {
              const f = d.focus as
                | "all"
                | "negative"
                | "positive"
                | "neutral"
                | undefined;
              push({
                id: `a${Date.now()}-n`,
                role: "agent",
                kind: "news",
                news: d.news,
                focus: f ?? "all",
                lead: d.lead,
              });
            } else if (d.kind === "risk" && d.analytics) {
              push({
                id: `a${Date.now()}-r`,
                role: "agent",
                kind: "risk",
                analytics: d.analytics,
              });
            } else if (d.kind === "stock" && d.quote) {
              push({
                id: `a${Date.now()}-sq`,
                role: "agent",
                kind: "stock",
                quote: d.quote,
                summary: d.summary,
              });
            } else if (d.kind === "stock_diagnosis" && d.diagnosis) {
              push({
                id: `a${Date.now()}-sd`,
                role: "agent",
                kind: "stock_diagnosis",
                diagnosis: d.diagnosis,
              });
            } else if (d.kind === "forecast" && d.forecast) {
              push({
                id: `a${Date.now()}-fc`,
                role: "agent",
                kind: "forecast",
                forecast: d.forecast,
              });
            } else if (d.kind === "sector_performance" && d.sector) {
              push({
                id: `a${Date.now()}-sp`,
                role: "agent",
                kind: "sector_performance",
                sector: d.sector,
              });
            } else if (d.kind === "trend_scan" && d.scan) {
              push({
                id: `a${Date.now()}-ts`,
                role: "agent",
                kind: "trend_scan",
                scan: d.scan,
              });
            } else if (d.kind === "holdings" && d.holdings) {
              const f = d.focus as "all" | "losers" | "gainers" | undefined;
              push({
                id: `a${Date.now()}-hp`,
                role: "agent",
                kind: "holdings",
                payload: {
                  holdings: d.holdings,
                  top_gainer: d.top_gainer ?? null,
                  top_loser: d.top_loser ?? null,
                  day_change_pct: d.day_change_pct ?? 0,
                },
                focus: f ?? "all",
                lead: d.lead,
              });
            } else if (d.kind === "note" && typeof d.text === "string") {
              push({
                id: `a${Date.now()}-nt`,
                role: "agent",
                kind: "note",
                text: d.text,
                tone: d.tone ?? "neutral",
              });
            } else if (d.kind === "mutual_funds" && d.funds) {
              push({
                id: `a${Date.now()}-mf`,
                role: "agent",
                kind: "mutual_funds",
                payload: {
                  summary: d.summary ?? "",
                  funds: d.funds,
                  weighted_day_change_pct: d.weighted_day_change_pct ?? 0,
                },
              });
            } else if (d.kind === "live_market" && d.indices) {
              push({
                id: `a${Date.now()}-lm`,
                role: "agent",
                kind: "live_market",
                payload: {
                  indices: d.indices,
                  avg_change_pct: d.avg_change_pct ?? 0,
                  sentiment: d.sentiment ?? "NEUTRAL",
                  summary: d.summary ?? "",
                },
              });
            }
          } else if (frame.event === "briefing_started") {
            // No-op — reasoning card will appear on first briefing tool_call
          } else if (frame.event === "start") {
            // Briefing LLM started streaming — push the streaming briefing card
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
          } else if (frame.event === "delta") {
            const d = frame.data as { text?: string };
            if (!d.text) continue;
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
            updateById(briefingId, "streaming_briefing", (m) => {
              const nextAcc = m.accumulated + d.text!;
              const parsed =
                tryParsePartial<typeof m.partial>(nextAcc) ?? m.partial;
              return { ...m, accumulated: nextAcc, partial: parsed };
            });
          } else if (frame.event === "briefing") {
            finalBriefing = frame.data as AdvisorBriefing;
            if (briefingPushed) {
              updateById(briefingId, "streaming_briefing", (m) => ({
                ...m,
                briefing: finalBriefing,
              }));
            }
          } else if (frame.event === "evaluation") {
            finalEval = frame.data as EvaluationResult;
            if (briefingPushed) {
              updateById(briefingId, "streaming_briefing", (m) => ({
                ...m,
                evaluation: finalEval,
              }));
            }
          } else if (frame.event === "done") {
            const d = frame.data as {
              latency_ms?: number;
              usage?: Record<string, number>;
            };
            if (reasoningPushed) {
              updateById(reasoningId, "reasoning", (r) => ({
                ...r,
                tokenUsage: d.usage,
                totalMs: d.latency_ms ?? Math.round(performance.now() - t0),
              }));
            }
          } else if (frame.event === "error") {
            const e = frame.data as { error: string; code?: number };
            setTyping(false);
            // 4xx → likely user-facing routing/input issue, surface short text.
            // 5xx / unknown → a system hiccup; friendly note instead of stack.
            const friendly =
              e.code && e.code < 500
                ? e.error
                : "I hit a snag on my end — give it a moment and try again. " +
                  "If it keeps happening, the model may be rate-limited.";
            push({
              id: `a${Date.now()}-e`,
              role: "agent",
              kind: "note",
              text: friendly,
              tone: "negative",
            });
            break;
          }
        }

        // Upgrade the streaming briefing to a final briefing kind for clean
        // persistence / export
        if (briefingPushed && finalBriefing) {
          setMessages((ms) =>
            ms.map((x) =>
              x.id === briefingId &&
              x.role === "agent" &&
              x.kind === "streaming_briefing"
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
          // Add the causal graph after the briefing
          push({
            id: `a${Date.now()}-g`,
            role: "agent",
            kind: "graph",
            briefing: finalBriefing,
            news: relevantNews,
          });
        }

        setTyping(false);
        // Final persist
        setMessages((curr) => {
          persist(curr);
          return curr;
        });
      } catch (err) {
        setTyping(false);
        const detail = err instanceof Error ? err.message : String(err);
        push({
          id: `a${Date.now()}-e`,
          role: "agent",
          kind: "note",
          text:
            "I couldn't reach the agent just now — looks like the connection " +
            "dropped. Try sending again.",
          tone: "negative",
        });
        // Console keeps the technical detail for debugging without putting a
        // stack-trace in the user's chat.
        console.warn("chat stream failed:", detail);
      }
    },
    [
      portfolioId,
      relevantNews,
      messages,
      push,
      appendText,
      updateById,
      persist,
    ],
  );

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!input.trim()) return;
    handlePrompt(input.trim());
    setInput("");
  }

  // ── Share / Export / menu ─────────────────────────────────────────
  const buildExportDoc = useCallback((): string | null => {
    const t = activeThreadRef.current;
    if (!t || t.messages.length === 0) return null;
    return threadToMarkdown(t, portfolio.user_name);
  }, [portfolio.user_name]);

  const onShare = useCallback(async () => {
    const md = buildExportDoc();
    if (!md) return toast("Nothing to share yet — ask me something first.", "warn");
    const ok = await copyMarkdown(md);
    toast(
      ok ? "Conversation copied to clipboard as markdown." : "Couldn't access clipboard.",
      ok ? "ok" : "warn",
    );
  }, [buildExportDoc, toast]);

  const onExport = useCallback(() => {
    const md = buildExportDoc();
    if (!md) return toast("Nothing to export yet.", "warn");
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

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    const t = setTimeout(() => document.addEventListener("click", close), 0);
    return () => {
      clearTimeout(t);
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
            className="tool-btn theme-toggle"
            onClick={onToggleTheme}
            title={theme === "dark" ? "Switch to light" : "Switch to dark"}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.6" />
                <path
                  d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M13 3l-1.4 1.4M4.4 11.6L3 13"
                  stroke="currentColor"
                  strokeWidth="1.6"
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
              <circle cx="12" cy="4" r="2" stroke="currentColor" strokeWidth="1.4" />
              <circle cx="4" cy="8" r="2" stroke="currentColor" strokeWidth="1.4" />
              <circle cx="12" cy="12" r="2" stroke="currentColor" strokeWidth="1.4" />
              <path
                d="M6 7l4-2M6 9l4 2"
                stroke="currentColor"
                strokeWidth="1.4"
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
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M3 13h10"
                stroke="currentColor"
                strokeWidth="1.4"
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
}: {
  msg: Extract<Msg, { role: "agent" }>;
  onPrompt: (text: string, intent?: Intent) => void;
}) {
  if (msg.kind === "text") return <Markdown>{msg.text}</Markdown>;
  if (msg.kind === "market") return <MarketSnapshotCard trend={msg.trend} />;
  if (msg.kind === "news")
    return <NewsCard news={msg.news} focus={msg.focus} lead={msg.lead} />;
  if (msg.kind === "risk") return <RiskCard analytics={msg.analytics} />;
  if (msg.kind === "stock")
    return <StockCard quote={msg.quote} summary={msg.summary} />;
  if (msg.kind === "stock_diagnosis")
    return <StockDiagnosisCard diagnosis={msg.diagnosis} />;
  if (msg.kind === "forecast") return <ForecastCard forecast={msg.forecast} />;
  if (msg.kind === "sector_performance")
    return <SectorPerformanceCard sector={msg.sector} />;
  if (msg.kind === "trend_scan") return <TrendScanCard scan={msg.scan} />;
  if (msg.kind === "holdings")
    return (
      <HoldingsCard
        payload={msg.payload}
        focus={msg.focus}
        lead={msg.lead}
      />
    );
  if (msg.kind === "mutual_funds") return <MutualFundsCard payload={msg.payload} />;
  if (msg.kind === "live_market") return <LiveMarketCard payload={msg.payload} />;
  if (msg.kind === "note") {
    // Animate only fresh notes — those whose id timestamp is within the last
    // 5 seconds. Persisted notes (reload, history) render instantly.
    const m = msg.id.match(/^a(\d+)/);
    const ts = m ? parseInt(m[1], 10) : 0;
    const fresh = ts > 0 && Date.now() - ts < 5000;
    return <NoteCard text={msg.text} tone={msg.tone} animate={fresh} />;
  }
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
    if (msg.briefing) {
      return <BriefingCard briefing={msg.briefing} evaluation={msg.evaluation} />;
    }
    return <BriefingCard briefing={msg.partial} evaluation={null} streaming />;
  }
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
