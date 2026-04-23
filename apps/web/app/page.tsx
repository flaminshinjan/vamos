import { api } from "@/lib/api";
import { MarketHeader } from "@/components/MarketHeader";
import { PortfolioSelector } from "@/components/PortfolioSelector";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let trend = null;
  let portfolios = null;
  let error: string | null = null;
  try {
    [trend, portfolios] = await Promise.all([
      api.marketTrend(),
      api.listPortfolios(),
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  if (error) {
    return (
      <div className="card border-accent-red/30 bg-accent-red/10">
        <h2 className="text-lg font-semibold text-accent-red">Backend unreachable</h2>
        <p className="mt-2 text-sm text-neutral-300">
          Could not reach the Vamos API. Make sure it is running:
        </p>
        <pre className="mt-3 rounded bg-ink-900 p-3 text-xs text-neutral-300">
          cd apps/api && uv run vamos-api
        </pre>
        <p className="mt-3 text-xs text-neutral-500">{error}</p>
      </div>
    );
  }

  return (
    <div>
      {trend && <MarketHeader trend={trend} />}
      <section>
        <div className="label mb-3">Select a portfolio</div>
        {portfolios && <PortfolioSelector portfolios={portfolios} />}
      </section>
    </div>
  );
}
