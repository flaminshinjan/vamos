// Typed API client for the Vamos backend.
// Used only from server components / route handlers (no CORS exposure on client).

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8247";

async function get<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    cache: "no-store",
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GET ${path} -> ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${path} -> ${res.status}: ${text.slice(0, 400)}`);
  }
  return res.json() as Promise<T>;
}

// ---------- Types (mirror backend schemas; kept minimal) ----------

export type PortfolioListItem = {
  portfolio_id: string;
  user_name: string;
  portfolio_type: string;
  risk_profile: string;
  description: string;
  current_value: number;
  overall_gain_loss_percent: number;
};

export type MarketTrend = {
  overall_sentiment: "BULLISH" | "BEARISH" | "NEUTRAL" | string;
  avg_broad_change: number;
  advancing_sectors: number;
  declining_sectors: number;
  top_gaining_sectors: [string, number][];
  top_losing_sectors: [string, number][];
  index_snapshot: Record<string, number>;
  rationale: string;
};

export type ConcentrationAlert = {
  level: "CRITICAL" | "HIGH" | "MODERATE";
  kind: "SECTOR" | "STOCK";
  name: string;
  weight_percent: number;
  message: string;
};

export type PortfolioAnalytics = {
  portfolio_id: string;
  total_investment: number;
  current_value: number;
  overall_gain_loss: number;
  overall_gain_loss_percent: number;
  day_summary: {
    day_change_absolute: number;
    day_change_percent: number;
    top_gainer?: { symbol: string; change_percent: number } | null;
    top_loser?: { symbol: string; change_percent: number } | null;
  };
  sector_allocation: Record<string, number>;
  asset_type_allocation: Record<string, number>;
  single_stock_max_weight: number;
  single_sector_max_weight: number;
  concentration_risk: boolean;
  alerts: ConcentrationAlert[];
};

export type Portfolio = {
  portfolio_id: string;
  user_name: string;
  portfolio_type: string;
  risk_profile: string;
  investment_horizon: string;
  description: string;
  total_investment: number;
  current_value: number;
  overall_gain_loss: number;
  overall_gain_loss_percent: number;
  holdings: {
    stocks: Array<{
      symbol: string;
      name: string;
      sector: string;
      quantity: number;
      current_price: number;
      current_value: number;
      gain_loss_percent: number;
      day_change_percent: number;
      weight_in_portfolio: number;
    }>;
    mutual_funds: Array<{
      scheme_code: string;
      scheme_name: string;
      category: string;
      current_value: number;
      gain_loss_percent: number;
      day_change_percent: number;
      weight_in_portfolio: number;
    }>;
  };
};

export type CausalChain = {
  trigger: string;
  sector: string;
  sector_impact_pct: number;
  stocks: string[];
  portfolio_impact_pct: number;
  narrative: string;
};

export type KeyInsight = {
  title: string;
  detail: string;
  severity: "INFO" | "WARN" | "CRITICAL";
};

export type ConflictSignal = {
  stock_or_sector: string;
  news_signal: string;
  price_signal: string;
  explanation: string;
};

export type EvaluationResult = {
  score: number;
  grounded: boolean;
  causal_depth: "SHALLOW" | "MODERATE" | "DEEP";
  missing_elements: string[];
  rationale: string;
  method: "llm_judge" | "rules_only" | "hybrid";
};

export type AdvisorBriefing = {
  portfolio_id: string;
  user_name: string;
  as_of_date: string;
  headline: string;
  summary: string;
  causal_chains: CausalChain[];
  key_insights: KeyInsight[];
  conflicts: ConflictSignal[];
  recommendations: string[];
  confidence: number;
  confidence_rationale: string;
  market_trend: MarketTrend;
  portfolio_analytics: PortfolioAnalytics;
  evaluation?: EvaluationResult | null;
  trace_id?: string | null;
  latency_ms?: number | null;
  token_usage?: Record<string, number> | null;
};

export type RelevantNews = {
  relevance_score: number;
  matched_sectors: string[];
  matched_stocks: string[];
  portfolio_exposure_pct: number;
  why_relevant: string;
  article: {
    id: string;
    headline: string;
    summary: string;
    sentiment: string;
    sentiment_score: number;
    scope: string;
    impact_level: string;
    source: string;
    published_at: string;
    entities: {
      sectors: string[];
      stocks: string[];
      indices: string[];
      keywords: string[];
    };
    causal_factors: string[];
  };
};

// ---------- API ----------

export const api = {
  listPortfolios: () => get<PortfolioListItem[]>("/portfolios"),
  getPortfolio: (id: string) => get<Portfolio>(`/portfolios/${id}`),
  portfolioAnalytics: (id: string) =>
    get<PortfolioAnalytics>(`/portfolios/${id}/analytics`),
  portfolioNews: (id: string, topK = 10) =>
    get<RelevantNews[]>(`/portfolios/${id}/relevant-news?top_k=${topK}`),
  marketTrend: () => get<MarketTrend>("/market/trend"),
  brief: (portfolioId: string, topNews = 8) =>
    post<AdvisorBriefing>("/advisor/brief", {
      portfolio_id: portfolioId,
      top_news: topNews,
    }),
};
