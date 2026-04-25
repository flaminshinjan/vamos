// Thread storage — localStorage-backed. Per-portfolio.
//
// Messages are stored as `SerializedMsg` so React state (functions, refs)
// doesn't leak into storage. The shape is a reduced version of the in-memory
// Msg union — just enough to reconstruct visible content on reload.

import type {
  AdvisorBriefing,
  EvaluationResult,
  HoldingsPayload,
  LiveMarketPayload,
  MarketForecast,
  MarketTrend,
  MutualFundsPayload,
  NoteTone,
  PortfolioAnalytics,
  RelevantNews,
  SectorPerformancePayload,
  StockDiagnosis,
  StockQuote,
  TrendScanPayload,
} from "@/lib/api";

export type SerializedMsg =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "agent"; kind: "text"; text: string }
  | { id: string; role: "agent"; kind: "followups" }
  | { id: string; role: "agent"; kind: "market"; trend: MarketTrend }
  | {
      id: string;
      role: "agent";
      kind: "news";
      news: RelevantNews[];
      focus?: "all" | "negative" | "positive" | "neutral";
      lead?: string;
    }
  | { id: string; role: "agent"; kind: "risk"; analytics: PortfolioAnalytics }
  | { id: string; role: "agent"; kind: "stock"; quote: StockQuote; summary?: string }
  | { id: string; role: "agent"; kind: "stock_diagnosis"; diagnosis: StockDiagnosis }
  | { id: string; role: "agent"; kind: "forecast"; forecast: MarketForecast }
  | { id: string; role: "agent"; kind: "sector_performance"; sector: SectorPerformancePayload }
  | { id: string; role: "agent"; kind: "trend_scan"; scan: TrendScanPayload }
  | {
      id: string;
      role: "agent";
      kind: "holdings";
      payload: HoldingsPayload;
      focus?: "all" | "losers" | "gainers";
      lead?: string;
    }
  | {
      id: string;
      role: "agent";
      kind: "note";
      text: string;
      tone: NoteTone;
    }
  | {
      id: string;
      role: "agent";
      kind: "mutual_funds";
      payload: MutualFundsPayload;
    }
  | {
      id: string;
      role: "agent";
      kind: "live_market";
      payload: LiveMarketPayload;
    }
  | {
      id: string;
      role: "agent";
      kind: "reasoning";
      steps: Array<{
        id: string;
        label: string;
        detail: string;
        status: "pending" | "active" | "done";
        duration_ms?: number;
      }>;
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
    }
  | {
      // In-flight streaming briefing. Upgraded to `briefing` once the stream
      // completes. Persisted as-is if the stream was interrupted, so a reload
      // can still show whatever was rendered.
      id: string;
      role: "agent";
      kind: "streaming_briefing";
      accumulated: string;
      partial: {
        headline?: string;
        summary?: string;
        causal_chains?: AdvisorBriefing["causal_chains"];
        key_insights?: AdvisorBriefing["key_insights"];
        conflicts?: AdvisorBriefing["conflicts"];
        recommendations?: AdvisorBriefing["recommendations"];
        confidence?: number;
        confidence_rationale?: string;
      };
      briefing: AdvisorBriefing | null;
      evaluation: EvaluationResult | null;
    };

export type Thread = {
  id: string;
  portfolioId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: SerializedMsg[];
};

const KEY = "vamos-threads-v1";

type Store = Record<string, Thread>;

function readStore(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Store;
  } catch {
    return {};
  }
}

function writeStore(s: Store): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* quota or parse errors — silently drop, we'll rebuild */
  }
}

export function listThreads(portfolioId?: string): Thread[] {
  const s = readStore();
  const all = Object.values(s);
  const filtered = portfolioId
    ? all.filter((t) => t.portfolioId === portfolioId)
    : all;
  return filtered.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getThread(id: string): Thread | null {
  return readStore()[id] ?? null;
}

export function saveThread(thread: Thread): void {
  const s = readStore();
  s[thread.id] = thread;
  writeStore(s);
}

export function deleteThread(id: string): void {
  const s = readStore();
  delete s[id];
  writeStore(s);
}

export function deriveTitle(firstUserMessage: string): string {
  const clean = firstUserMessage.trim().replace(/\s+/g, " ");
  return clean.length > 60 ? clean.slice(0, 59) + "…" : clean;
}

export function formatWhen(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  if (sameDay) return `Today · ${hh}:${mm}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const wasYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  if (wasYesterday) return `Yesterday · ${hh}:${mm}`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
