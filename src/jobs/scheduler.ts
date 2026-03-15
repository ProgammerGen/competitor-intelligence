import cron from "node-cron";
import { runModule } from "@/lib/modules";
import { syncCompanyProducts } from "@/lib/services/companyProducts";
import { db } from "@/lib/db";
import { userCompanies } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const MODULE_TYPES = [
  "news",
  "product_launch",
  "review",
  "job_posting",
] as const;

export function initScheduler(): void {
  // Run all modules daily at 6 AM Eastern — sequential to avoid API rate limits
  cron.schedule(
    "0 6 * * *",
    async () => {
      console.log("[scheduler] Starting daily sync");

      // Refresh the user's own product catalog before running modules
      try {
        const company = await db.query.userCompanies.findFirst({
          where: eq(userCompanies.confirmed, true),
        });
        if (company) {
          await syncCompanyProducts(company);
          console.log("[scheduler] Company products refreshed");
        }
      } catch (err) {
        console.error("[scheduler] Company product sync failed:", err);
      }

      for (const moduleType of MODULE_TYPES) {
        try {
          await runModule(moduleType);
        } catch (err) {
          console.error(`[scheduler] ${moduleType} failed:`, err);
        }
      }
      console.log("[scheduler] Daily sync complete");
    },
    { timezone: "America/New_York" }
  );

  console.log("[scheduler] Initialized — daily sync at 06:00 ET");
}
