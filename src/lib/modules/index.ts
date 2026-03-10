import { db } from "@/lib/db";
import {
  moduleRuns,
  trackedCompetitors,
  userCompanies,
} from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { runProductsModule } from "./products";
import { runNewsModule } from "./news";
import { runRedditModule } from "./reddit";
import { runJobsModule } from "./jobs";

type ModuleType = "news" | "product_launch" | "review" | "job_posting";

export async function runModule(
  moduleType: ModuleType,
  competitorId?: string
): Promise<void> {
  const company = await db.query.userCompanies.findFirst({
    where: eq(userCompanies.confirmed, true),
  });
  if (!company) return;

  const competitors = await db
    .select()
    .from(trackedCompetitors)
    .where(
      and(
        eq(trackedCompetitors.userCompanyId, company.id),
        eq(trackedCompetitors.active, true),
        ...(competitorId
          ? [eq(trackedCompetitors.id, competitorId)]
          : [])
      )
    );

  for (const competitor of competitors) {
    const [run] = await db
      .insert(moduleRuns)
      .values({
        competitorId: competitor.id,
        moduleType,
        status: "running",
      })
      .returning();

    try {
      switch (moduleType) {
        case "product_launch":
          await runProductsModule(competitor, company);
          break;
        case "news":
          await runNewsModule(competitor, company);
          break;
        case "review":
          await runRedditModule(competitor, company);
          break;
        case "job_posting":
          await runJobsModule(competitor, company);
          break;
      }

      await db
        .update(moduleRuns)
        .set({ status: "success", completedAt: new Date() })
        .where(eq(moduleRuns.id, run.id));
    } catch (err) {
      await db
        .update(moduleRuns)
        .set({
          status: "error",
          completedAt: new Date(),
          errorMessage: err instanceof Error ? err.message : String(err),
        })
        .where(eq(moduleRuns.id, run.id));
    }
  }
}
