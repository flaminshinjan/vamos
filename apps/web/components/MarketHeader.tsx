import { type MarketTrend } from "@/lib/api";
import { formatPct, pnlColor, sentimentColor } from "@/lib/format";

export function MarketHeader({ trend }: { trend: MarketTrend }) {
  return (
    <section className="card mb-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="label">Market sentiment</div>
          <div className={`mt-1 text-3xl font-semibold ${sentimentColor(trend.overall_sentiment)}`}>
            {trend.overall_sentiment}
          </div>
          <p className="mt-2 text-sm text-neutral-400">{trend.rationale}</p>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-right sm:grid-cols-3">
          {Object.entries(trend.index_snapshot).map(([name, pct]) => (
            <div key={name}>
              <div className="label">{name}</div>
              <div className={`font-mono text-lg ${pnlColor(pct)}`}>{formatPct(pct)}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <div className="label mb-2">Top gaining sectors</div>
          <ul className="space-y-1 text-sm">
            {trend.top_gaining_sectors.map(([sec, pct]) => (
              <li key={sec} className="flex justify-between">
                <span className="text-neutral-300">{sec}</span>
                <span className={`font-mono ${pnlColor(pct)}`}>{formatPct(pct)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="label mb-2">Top losing sectors</div>
          <ul className="space-y-1 text-sm">
            {trend.top_losing_sectors.map(([sec, pct]) => (
              <li key={sec} className="flex justify-between">
                <span className="text-neutral-300">{sec}</span>
                <span className={`font-mono ${pnlColor(pct)}`}>{formatPct(pct)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
