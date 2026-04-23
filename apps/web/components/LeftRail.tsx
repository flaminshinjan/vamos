"use client";

import type { PortfolioListItem } from "@/lib/api";
import type { Thread } from "@/lib/threads";
import { formatWhen } from "@/lib/threads";

export function LeftRail({
  portfolios,
  activePortfolioId,
  onPickPortfolio,
  threads,
  activeThreadId,
  onPickThread,
  onDeleteThread,
  onNewChat,
  userName = "Rohan Sharma",
  userMeta = "Mock account · INR",
  theme,
  onToggleTheme,
}: {
  portfolios: PortfolioListItem[];
  activePortfolioId: string;
  onPickPortfolio: (id: string) => void;
  threads: Thread[];
  activeThreadId: string | null;
  onPickThread: (id: string) => void;
  onDeleteThread: (id: string) => void;
  onNewChat: () => void;
  userName?: string;
  userMeta?: string;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}) {
  return (
    <aside className="rail">
      <div className="rail-header">
        <div className="mark">A</div>
        <div className="brand-text">
          Aarthik
          <small>autonomous advisor</small>
        </div>
      </div>

      <button className="new-chat" onClick={onNewChat}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 3v10M3 8h10"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
          New briefing
        </span>
        <kbd>⌘K</kbd>
      </button>

      <div
        className="rail-section"
        style={{
          flexShrink: 0,
          borderBottom: "1px solid var(--line)",
          paddingBottom: 12,
        }}
      >
        <div className="rail-label">Portfolios</div>
        {portfolios.map((p) => {
          const neg = p.overall_gain_loss_percent < 0;
          const active = p.portfolio_id === activePortfolioId;
          return (
            <button
              key={p.portfolio_id}
              className={`rail-item ${active ? "active" : ""}`}
              onClick={() => onPickPortfolio(p.portfolio_id)}
            >
              <span
                className="ri-dot"
                style={{ background: neg ? "var(--neg)" : "var(--pos)" }}
              />
              <span className="ri-main">
                <div className="ri-name">{p.user_name}</div>
                <div className="ri-sub">{p.portfolio_type.toLowerCase()}</div>
              </span>
              <span className="ri-meta">
                {neg ? "−" : "+"}
                {Math.abs(p.overall_gain_loss_percent).toFixed(1)}%
              </span>
            </button>
          );
        })}
      </div>

      <div className="rail-section" style={{ flex: 1, overflowY: "auto" }}>
        <div className="rail-label">
          Threads
          <span
            className="mono"
            style={{ fontSize: 10, color: "var(--ink-4)" }}
          >
            {threads.length}
          </span>
        </div>
        {threads.length === 0 ? (
          <div
            style={{
              padding: "12px 8px",
              fontSize: 11.5,
              color: "var(--ink-4)",
              lineHeight: 1.5,
            }}
          >
            No threads yet. Ask a question to start one.
          </div>
        ) : (
          threads.map((t) => (
            <div
              key={t.id}
              className={`rail-item ${activeThreadId === t.id ? "active" : ""}`}
              style={{ position: "relative" }}
              onClick={() => onPickThread(t.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onPickThread(t.id);
                }
              }}
            >
              <span className="ri-main">
                <div className="ri-name">{t.title}</div>
                <div className="ri-sub">{formatWhen(t.updatedAt)}</div>
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Delete "${t.title}"?`)) onDeleteThread(t.id);
                }}
                title="Delete thread"
                style={{
                  opacity: activeThreadId === t.id ? 0.8 : 0.3,
                  fontSize: 14,
                  padding: "0 4px",
                  color: "inherit",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>

      <div className="rail-footer">
        <div className="avatar">
          {userName
            .split(" ")
            .map((w) => w[0])
            .join("")
            .slice(0, 2)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 500, fontSize: 12.5 }}>{userName}</div>
          <div style={{ fontSize: 11, color: "var(--ink-3)" }}>{userMeta}</div>
        </div>
        <button
          className="tool-btn"
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          onClick={onToggleTheme}
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
        </button>
      </div>
    </aside>
  );
}
