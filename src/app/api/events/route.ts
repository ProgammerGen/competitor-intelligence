import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { db } from "@/lib/db";
import { events, relevanceScores, trackedCompetitors, userCompanies } from "@/lib/db/schema";
import { and, desc, eq, gte, ne, or } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const competitorId = searchParams.get("competitorId");
  const moduleType = searchParams.get("moduleType") as
    | "news"
    | "product_launch"
    | "review"
    | "job_posting"
    | null;
  const minScore = parseInt(searchParams.get("minScore") ?? "0", 10);
  const sort = searchParams.get("sort") === "date" ? "date" : "score";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);

  // Products are never noise — always show them regardless of isNoise flag
  const isProductTab = moduleType === "product_launch";

  const conditions = [
    ne(relevanceScores.finalScore, 0), // suppress 90+ day events
    ...(isProductTab
      ? [] // products: no noise filter — every launch matters
      : [eq(relevanceScores.isNoise, false)]),
    gte(relevanceScores.finalScore, minScore),
  ];

  if (competitorId) {
    conditions.push(eq(events.competitorId, competitorId));
  }
  if (moduleType) {
    conditions.push(eq(events.moduleType, moduleType));
  }

  const rows = await db
    .select({
      event: events,
      score: relevanceScores,
      competitor: {
        id: trackedCompetitors.id,
        name: trackedCompetitors.name,
        domain: trackedCompetitors.domain,
      },
    })
    .from(events)
    .innerJoin(relevanceScores, eq(relevanceScores.eventId, events.id))
    .innerJoin(trackedCompetitors, eq(trackedCompetitors.id, events.competitorId))
    .innerJoin(userCompanies, eq(userCompanies.id, trackedCompetitors.userCompanyId))
    .where(and(...conditions))
    .orderBy(
      sort === "date"
        ? desc(events.eventOccurredAt)
        : desc(relevanceScores.finalScore)
    )
    .limit(limit)
    .offset(offset);

  return NextResponse.json(rows);
}
