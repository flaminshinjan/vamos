import Link from "next/link";
import { type PortfolioListItem } from "@/lib/api";
import { formatINR, formatPct, pnlColor } from "@/lib/format";

export function PortfolioSelector({
  portfolios,
  activeId,
}: {
  portfolios: PortfolioListItem[];
  activeId?: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {portfolios.map((p) => {
        const active = p.portfolio_id === activeId;
        return (
          <Link
            key={p.portfolio_id}
            href={`/portfolio/${p.portfolio_id}`}
            className={`card transition hover:border-accent-blue/50 ${
              active ? "border-accent-blue ring-1 ring-accent-blue/30" : ""
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-neutral-300">{p.user_name}</div>
              <span className="pill bg-ink-700 text-neutral-400">
                {p.risk_profile}
              </span>
            </div>
            <div className="mt-2 text-xs text-neutral-500">{p.portfolio_type}</div>
            <div className="mt-4 flex items-baseline gap-3">
              <div className="text-xl font-semibold">{formatINR(p.current_value)}</div>
              <div className={`font-mono text-sm ${pnlColor(p.overall_gain_loss_percent)}`}>
                {formatPct(p.overall_gain_loss_percent)}
              </div>
            </div>
            <p className="mt-3 line-clamp-2 text-xs text-neutral-500">{p.description}</p>
          </Link>
        );
      })}
    </div>
  );
}
