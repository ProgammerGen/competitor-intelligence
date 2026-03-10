export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { moduleRuns, trackedCompetitors, userCompanies } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

export async function GET() {
  const company = await db.query.userCompanies.findFirst({
    where: eq(userCompanies.confirmed, true),
  });
  if (!company) return NextResponse.json([]);

  const competitors = await db
    .select()
    .from(trackedCompetitors)
    .where(eq(trackedCompetitors.userCompanyId, company.id));

  const allRuns = await db
    .select()
    .from(moduleRuns)
    .orderBy(desc(moduleRuns.startedAt));

  // Return latest run per (competitorId, moduleType)
  const latestMap = new Map<string, typeof allRuns[0]>();
  for (const run of allRuns) {
    const key = `${run.competitorId}:${run.moduleType}`;
    if (!latestMap.has(key)) {
      latestMap.set(key, run);
    }
  }

  const result = competitors.map((c) => ({
    competitor: { id: c.id, name: c.name, domain: c.domain },
    modules: {
      news: latestMap.get(`${c.id}:news`) ?? null,
      product_launch: latestMap.get(`${c.id}:product_launch`) ?? null,
      review: latestMap.get(`${c.id}:review`) ?? null,
      job_posting: latestMap.get(`${c.id}:job_posting`) ?? null,
    },
  }));

  return NextResponse.json(result);
}
