import { NextResponse } from "next/server";
import { api } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const portfolioId = body.portfolio_id as string;
    const topNews = (body.top_news as number | undefined) ?? 8;
    if (!portfolioId) {
      return NextResponse.json(
        { error: "portfolio_id is required" },
        { status: 400 },
      );
    }
    const briefing = await api.brief(portfolioId, topNews);
    return NextResponse.json(briefing);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
