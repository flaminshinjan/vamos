import { type Portfolio } from "@/lib/api";
import { formatINR, formatPct, pnlColor } from "@/lib/format";

export function HoldingsTable({ portfolio }: { portfolio: Portfolio }) {
  const stocks = [...portfolio.holdings.stocks].sort(
    (a, b) => b.weight_in_portfolio - a.weight_in_portfolio,
  );
  const funds = [...portfolio.holdings.mutual_funds].sort(
    (a, b) => b.weight_in_portfolio - a.weight_in_portfolio,
  );
  return (
    <section className="card">
      <h3 className="mb-4 text-lg font-semibold">Holdings</h3>
      {stocks.length > 0 && (
        <>
          <div className="label mb-2">Stocks</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-600 text-left text-xs uppercase tracking-wider text-neutral-500">
                  <th className="py-2">Symbol</th>
                  <th>Sector</th>
                  <th className="text-right">Weight</th>
                  <th className="text-right">Day</th>
                  <th className="text-right">Overall</th>
                  <th className="text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {stocks.map((h) => (
                  <tr key={h.symbol} className="border-b border-ink-700 last:border-0">
                    <td className="py-2 font-medium">{h.symbol}</td>
                    <td className="text-neutral-400">{h.sector}</td>
                    <td className="text-right font-mono">{h.weight_in_portfolio.toFixed(1)}%</td>
                    <td className={`text-right font-mono ${pnlColor(h.day_change_percent)}`}>
                      {formatPct(h.day_change_percent)}
                    </td>
                    <td className={`text-right font-mono ${pnlColor(h.gain_loss_percent)}`}>
                      {formatPct(h.gain_loss_percent)}
                    </td>
                    <td className="text-right font-mono text-neutral-300">
                      {formatINR(h.current_value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {funds.length > 0 && (
        <div className="mt-6">
          <div className="label mb-2">Mutual funds</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-600 text-left text-xs uppercase tracking-wider text-neutral-500">
                  <th className="py-2">Scheme</th>
                  <th>Category</th>
                  <th className="text-right">Weight</th>
                  <th className="text-right">Day</th>
                  <th className="text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {funds.map((f) => (
                  <tr key={f.scheme_code} className="border-b border-ink-700 last:border-0">
                    <td className="py-2">
                      <div className="font-medium">{f.scheme_name}</div>
                      <div className="text-xs text-neutral-500">{f.scheme_code}</div>
                    </td>
                    <td className="text-neutral-400">{f.category}</td>
                    <td className="text-right font-mono">{f.weight_in_portfolio.toFixed(1)}%</td>
                    <td className={`text-right font-mono ${pnlColor(f.day_change_percent)}`}>
                      {formatPct(f.day_change_percent)}
                    </td>
                    <td className="text-right font-mono text-neutral-300">
                      {formatINR(f.current_value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
