"use client";

import type { HoldingsPayload } from "@/lib/api";
import { formatINR } from "@/lib/format";

type Focus = "all" | "losers" | "gainers";

const FOCUS_LABEL: Record<Focus, string> = {
  all: "Holdings performance",
  losers: "Losers today",
  gainers: "Gainers today",
};

export function HoldingsCard({
  payload,
  focus = "all",
  lead,
}: {
  payload: HoldingsPayload;
  focus?: Focus;
  lead?: string;
}) {
  const { holdings, top_gainer, top_loser, day_change_pct } = payload;
  const totalColor =
    day_change_pct == null
      ? "var(--ink)"
      : day_change_pct < 0
        ? "var(--neg)"
        : "var(--pos)";

  const title = FOCUS_LABEL[focus] ?? FOCUS_LABEL.all;
  const positionLabel = `${holdings.length} position${holdings.length === 1 ? "" : "s"}`;

  return (
    <div className="card fade-up">
      <div className="card-head">
        <div className="card-title">
          <span
            className={`dot ${day_change_pct < 0 ? "neg" : "pos"}`}
          />
          {title}
        </div>
        <div className="card-sub">{positionLabel} · NSE close</div>
      </div>
      {lead && (
        <div
          style={{
            padding: "10px 18px 0",
            fontSize: 12.5,
            color: "var(--ink-2)",
            lineHeight: 1.5,
          }}
        >
          {lead}
        </div>
      )}
      <div className="card-body">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 16,
            paddingBottom: 14,
            borderBottom: "1px dashed var(--line)",
            marginBottom: 14,
          }}
        >
          <Stat
            label="Day P&L"
            value={`${day_change_pct >= 0 ? "+" : "−"}${Math.abs(day_change_pct).toFixed(2)}%`}
            color={totalColor}
          />
          <Stat
            label="Top gainer"
            value={
              top_gainer
                ? `${top_gainer.symbol} ${fmtSigned(top_gainer.change_percent)}`
                : "—"
            }
            color="var(--pos)"
          />
          <Stat
            label="Top loser"
            value={
              top_loser
                ? `${top_loser.symbol} ${fmtSigned(top_loser.change_percent)}`
                : "—"
            }
            color="var(--neg)"
          />
        </div>

        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 12.5,
          }}
        >
          <thead>
            <tr style={{ color: "var(--ink-3)", textAlign: "left" }}>
              <th style={th}>Symbol</th>
              <th style={th}>Sector</th>
              <th style={{ ...th, textAlign: "right" }}>Weight</th>
              <th style={{ ...th, textAlign: "right" }}>Day</th>
              <th style={{ ...th, textAlign: "right" }}>Overall</th>
              <th style={{ ...th, textAlign: "right" }}>Value</th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((h) => (
              <tr key={h.symbol} style={{ borderTop: "1px solid var(--line)" }}>
                <td style={{ ...td, fontWeight: 500 }}>{h.symbol}</td>
                <td style={{ ...td, color: "var(--ink-3)" }}>{h.sector}</td>
                <td style={{ ...td, textAlign: "right" }} className="mono tnum">
                  {h.weight_pct.toFixed(1)}%
                </td>
                <td
                  style={{
                    ...td,
                    textAlign: "right",
                    color: h.day_change_pct < 0 ? "var(--neg)" : "var(--pos)",
                  }}
                  className="mono tnum"
                >
                  {fmtSigned(h.day_change_pct)}
                </td>
                <td
                  style={{
                    ...td,
                    textAlign: "right",
                    color:
                      h.overall_gain_pct < 0 ? "var(--neg)" : "var(--pos)",
                  }}
                  className="mono tnum"
                >
                  {fmtSigned(h.overall_gain_pct)}
                </td>
                <td style={{ ...td, textAlign: "right" }} className="mono tnum">
                  {formatINR(h.current_value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 4 }}>
        {label}
      </div>
      <div
        className="serif"
        style={{
          fontSize: 18,
          letterSpacing: "-0.01em",
          color: color ?? "var(--ink)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function fmtSigned(v: number): string {
  return `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(2)}%`;
}

const th: React.CSSProperties = {
  padding: "6px 0",
  fontWeight: 500,
  fontSize: 11,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};
const td: React.CSSProperties = { padding: "8px 0" };
