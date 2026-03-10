import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  trackedCompetitors,
  events,
  relevanceScores,
  moduleRuns,
  productSnapshots,
} from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const eventIds = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.competitorId, id));

  if (eventIds.length > 0) {
    await db.delete(relevanceScores).where(
      inArray(relevanceScores.eventId, eventIds.map((e) => e.id))
    );
  }
  await db.delete(events).where(eq(events.competitorId, id));
  await db.delete(moduleRuns).where(eq(moduleRuns.competitorId, id));
  await db.delete(productSnapshots).where(eq(productSnapshots.competitorId, id));
  await db.delete(trackedCompetitors).where(eq(trackedCompetitors.id, id));

  return NextResponse.json({ ok: true });
}
