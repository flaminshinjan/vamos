"use client";

import type { MarketForecast } from "@/lib/api";

export function ForecastCard({ forecast }: { forecast: MarketForecast }) {
  const m5 = forecast.momentum_pct_5d;
  const m20 = forecast.momentum_pct_20d;
  const polyline = buildSparkline(forecast.historical.map((p) => p.close));

  return (
    <div className="card fade-up">
      <div className="card-head">
        <div className="card-title">
          <span className="dot accent" />
          Market forecast
        </div>
        <div className="card-sub">{forecast.headline}</div>
      </div>
      <div className="card-body">
        {polyline && (
          <svg
            viewBox="0 0 200 60"
            style={{ width: "100%", height: 80, marginBottom: 12 }}
          >
            <polyline
              fill="none"
              stroke="var(--accent)"
              strokeWidth={1.4}
              points={polyline}
            />
          </svg>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            paddingBottom: 14,
            borderBottom: "1px dashed var(--line)",
            marginBottom: 14,
          }}
        >
          <Momentum label="5-day" value={m5} />
          <Momentum label="20-day" value={m20} />
        </div>

        <div className="eyebrow" style={{ marginBottom: 6 }}>
          Outlook
        </div>
        <p
          style={{
            margin: "0 0 16px",
            fontSize: 13.5,
            color: "var(--ink-2)",
            lineHeight: 1.55,
          }}
        >
          {forecast.outlook}
        </p>

        <div className="eyebrow" style={{ marginBottom: 6 }}>
          What's driving today
        </div>
        <p
          style={{
            margin: "0 0 16px",
            fontSize: 13,
            color: "var(--ink-2)",
            lineHeight: 1.55,
            whiteSpace: "pre-wrap",
          }}
        >
          {forecast.current_summary}
        </p>

        {forecast.headlines.length > 0 && (
          <>
            <div className="eyebrow" style={{ marginBottom: 8 }}>
              Top headlines
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {forecast.headlines.slice(0, 6).map((h, i) => (
                <li
                  key={`${h.url}-${i}`}
                  style={{
                    padding: "6px 0",
                    borderTop: i === 0 ? "none" : "1px solid var(--line)",
                    fontSize: 12.5,
                  }}
                >
                  <a
                    href={h.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "var(--ink)", textDecoration: "none" }}
                  >
                    {h.title}
                  </a>
                  <span style={{ color: "var(--ink-3)", marginLeft: 6 }}>
                    · {h.source}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function Momentum({ label, value }: { label: string; value: number | null }) {
  const color =
    value == null
      ? "var(--ink-3)"
      : value < 0
        ? "var(--neg)"
        : "var(--pos)";
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 4 }}>
        {label}
      </div>
      <div
        className="serif"
        style={{ fontSize: 24, letterSpacing: "-0.02em", color }}
      >
        {value == null
          ? "—"
          : `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(2)}%`}
      </div>
    </div>
  );
}

function buildSparkline(values: number[]): string | null {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = 200 / (values.length - 1);
  return values
    .map((v, i) => {
      const x = (i * stepX).toFixed(2);
      const y = (60 - ((v - min) / range) * 56 - 2).toFixed(2);
      return `${x},${y}`;
    })
    .join(" ");
}
