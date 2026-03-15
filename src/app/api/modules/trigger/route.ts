import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import { runModule } from "@/lib/modules";
import { db } from "@/lib/db";
import { events, relevanceScores } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";

type ModuleType = "news" | "product_launch" | "review" | "job_posting";
const VALID_MODULES: ModuleType[] = ["news", "product_launch", "review", "job_posting"];

export async function POST(req: NextRequest) {
  const { moduleType, competitorId, resync } = (await req.json()) as {
    moduleType: ModuleType;
    competitorId?: string;
    resync?: boolean;
  };

  if (!VALID_MODULES.includes(moduleType)) {
    return NextResponse.json({ error: "Invalid moduleType" }, { status: 400 });
  }

  // after() keeps the serverless function alive after response is sent (works on Vercel)
  after(async () => {
    try {
      // If resync is requested, clear old events + scores for this module type
      // so that idempotency doesn't block re-scoring with the new prompt
      if (resync) {
        await clearModuleEvents(moduleType, competitorId);
      }

      await runModule(moduleType, competitorId);
    } catch (err) {
      console.error(`[trigger] ${moduleType} error:`, err);
    }
  });

  return NextResponse.json({ status: resync ? "resync_triggered" : "triggered" });
}

async function clearModuleEvents(
  moduleType: ModuleType,
  competitorId?: string
): Promise<void> {
  // Find all events for this module type (optionally filtered by competitor)
  const conditions = [eq(events.moduleType, moduleType)];
  if (competitorId) {
    conditions.push(eq(events.competitorId, competitorId));
  }

  const targetEvents = await db
    .select({ id: events.id })
    .from(events)
    .where(and(...conditions));

  if (targetEvents.length === 0) return;

  const eventIds = targetEvents.map((e) => e.id);

  // Delete scores first (foreign key), then events
  await db
    .delete(relevanceScores)
    .where(inArray(relevanceScores.eventId, eventIds));
  await db
    .delete(events)
    .where(inArray(events.id, eventIds));
}
