import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  companyProducts,
  events,
  relevanceScores,
  trackedCompetitors,
} from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const product = await db.query.companyProducts.findFirst({
    where: eq(companyProducts.id, id),
  });
  if (!product) return NextResponse.json([]);

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
    .where(sql`${relevanceScores.matchedProducts}::jsonb ? ${product.title}`)
    .orderBy(desc(events.eventOccurredAt))
    .limit(20);

  return NextResponse.json(rows);
}
