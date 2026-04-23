import { type Portfolio, type PortfolioAnalytics } from "@/lib/api";
import { formatINR, formatPct, pnlColor } from "@/lib/format";

export function PortfolioSnapshot({
  portfolio,
  analytics,
}: {
  portfolio: Portfolio;
  analytics: PortfolioAnalytics;
}) {
  const { day_summary } = analytics;
  return (
    <section className="card mb-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="label">{portfolio.user_name}</div>
          <div className="mt-1 text-2xl font-semibold">{portfolio.description}</div>
        </div>
        <div className="text-right">
          <div className="label">Portfolio value</div>
          <div className="stat">{formatINR(analytics.current_value)}</div>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Metric
          label="Day P&L"
          value={formatINR(day_summary.day_change_absolute)}
          sub={formatPct(day_summary.day_change_percent)}
          valueClass={pnlColor(day_summary.day_change_absolute)}
          subClass={pnlColor(day_summary.day_change_percent)}
        />
        <Metric
          label="Overall gain"
          value={formatINR(analytics.overall_gain_loss)}
          sub={formatPct(analytics.overall_gain_loss_percent)}
          valueClass={pnlColor(analytics.overall_gain_loss)}
          subClass={pnlColor(analytics.overall_gain_loss_percent)}
        />
        <Metric
          label="Max sector weight"
          value={`${analytics.single_sector_max_weight.toFixed(1)}%`}
          sub="ex-MF bucket"
        />
        <Metric
          label="Max single stock"
          value={`${analytics.single_stock_max_weight.toFixed(1)}%`}
          sub={day_summary.top_loser?.symbol ?? "—"}
        />
      </div>

      {analytics.alerts.length > 0 && (
        <div className="mt-6 rounded-lg border border-accent-red/30 bg-accent-red/10 p-4">
          <div className="label text-accent-red">Concentration risk</div>
          <ul className="mt-2 space-y-1 text-sm">
            {analytics.alerts.map((a, i) => (
              <li key={i}>
                <span className="font-medium text-neutral-200">[{a.level}]</span>{" "}
                <span className="text-neutral-300">{a.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Metric({
  label,
  value,
  sub,
  valueClass = "",
  subClass = "text-neutral-400",
}: {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
  subClass?: string;
}) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${valueClass}`}>{value}</div>
      {sub && <div className={`mt-0.5 text-xs ${subClass}`}>{sub}</div>}
    </div>
  );
}
