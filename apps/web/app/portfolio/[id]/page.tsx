import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { BriefingPanel } from "@/components/BriefingPanel";
import { HoldingsTable } from "@/components/HoldingsTable";
import { MarketHeader } from "@/components/MarketHeader";
import { PortfolioSelector } from "@/components/PortfolioSelector";
import { PortfolioSnapshot } from "@/components/PortfolioSnapshot";

export const dynamic = "force-dynamic";

export default async function PortfolioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  try {
    const [trend, portfolios, portfolio, analytics] = await Promise.all([
      api.marketTrend(),
      api.listPortfolios(),
      api.getPortfolio(id),
      api.portfolioAnalytics(id),
    ]);

    return (
      <div>
        <MarketHeader trend={trend} />
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="text-sm text-neutral-400 hover:text-accent-blue"
          >
            ← All portfolios
          </Link>
        </div>
        <PortfolioSelector portfolios={portfolios} activeId={id} />
        <div className="my-8" />
        <PortfolioSnapshot portfolio={portfolio} analytics={analytics} />
        <div className="grid gap-6 lg:grid-cols-2">
          <HoldingsTable portfolio={portfolio} />
          <BriefingPanel portfolioId={id} />
        </div>
      </div>
    );
  } catch (e) {
    if (e instanceof Error && e.message.includes("404")) {
      notFound();
    }
    throw e;
  }
}
