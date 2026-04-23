"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type MarketTrend, type Portfolio, type PortfolioAnalytics, type PortfolioListItem, type RelevantNews } from "@/lib/api";
import { Chat } from "@/components/Chat";
import { ContextRail } from "@/components/ContextRail";
import { LeftRail } from "@/components/LeftRail";

const DEFAULT_THREADS = [
  { id: "t1", title: "Why is BANKNIFTY leading the drag?", when: "Today · 4:12 pm" },
  { id: "t2", title: "IT vs FMCG outlook for Q1", when: "Yesterday" },
  { id: "t3", title: "Rebalance ideas for Priya's book", when: "Apr 22" },
  { id: "t4", title: "RBI rate path sensitivity", when: "Apr 21" },
];

export default function HomePage() {
  const [portfolios, setPortfolios] = useState<PortfolioListItem[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [err, setErr] = useState<string | null>(null);

  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [analytics, setAnalytics] = useState<PortfolioAnalytics | null>(null);
  const [trend, setTrend] = useState<MarketTrend | null>(null);
  const [news, setNews] = useState<RelevantNews[] | null>(null);

  // Pick up theme on mount
  useEffect(() => {
    const saved = (localStorage.getItem("vamos-theme") as "light" | "dark") || "light";
    setTheme(saved);
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  // Load portfolios on mount
  useEffect(() => {
    api
      .listPortfolios()
      .then((list) => {
        setPortfolios(list);
        if (list.length > 0 && !activeId) setActiveId(list[0].portfolio_id);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load portfolio data when switching
  useEffect(() => {
    if (!activeId) return;
    setPortfolio(null);
    setAnalytics(null);
    setNews(null);
    Promise.all([
      api.getPortfolio(activeId),
      api.portfolioAnalytics(activeId),
      api.marketTrend(),
      api.portfolioNews(activeId, 10),
    ])
      .then(([p, a, t, n]) => {
        setPortfolio(p);
        setAnalytics(a);
        setTrend(t);
        setNews(n);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, [activeId]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("vamos-theme", next);
      return next;
    });
  }, []);

  const onPickPortfolio = useCallback((id: string) => {
    setActiveId(id);
    setThreadId(null);
  }, []);

  const onNewChat = useCallback(() => {
    setThreadId(null);
    // Reset chat state by nudging activeId (Chat resets on portfolioId change)
    setActiveId((id) => (id ? id + "" : id));
  }, []);

  const ready = portfolios && activeId && portfolio && analytics && trend && news;

  if (err) {
    return (
      <div className="shell" style={{ gridTemplateColumns: "1fr", minWidth: 0 }}>
        <div
          style={{
            padding: 48,
            maxWidth: 620,
            margin: "60px auto",
            background: "var(--bg-elev)",
            border: "1px solid var(--line)",
            borderRadius: 12,
          }}
        >
          <h2 className="serif" style={{ fontSize: 28, margin: 0 }}>
            Backend unreachable
          </h2>
          <p style={{ color: "var(--ink-3)", marginTop: 12 }}>
            Couldn&apos;t reach the Vamos API. Make sure it&apos;s running:
          </p>
          <pre
            style={{
              marginTop: 12,
              padding: 14,
              background: "var(--bg-sunk)",
              borderRadius: 8,
              fontSize: 12,
            }}
          >
            ./scripts/dev.sh
          </pre>
          <p style={{ fontSize: 12, color: "var(--ink-4)", marginTop: 12 }}>
            {err}
          </p>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="shell">
        <div style={{ gridColumn: "1 / -1", display: "grid", placeItems: "center", height: "100vh" }}>
          <div className="typing-indicator">
            <span />
            <span />
            <span />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="shell">
      <LeftRail
        portfolios={portfolios}
        activePortfolioId={activeId}
        onPickPortfolio={onPickPortfolio}
        threads={DEFAULT_THREADS}
        activeThreadId={threadId}
        onPickThread={setThreadId}
        onNewChat={onNewChat}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <Chat
        portfolio={portfolio}
        portfolioId={activeId}
        trend={trend}
        analytics={analytics}
        relevantNews={news}
      />
      <ContextRail portfolio={portfolio} analytics={analytics} news={news} />
    </div>
  );
}
