export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { trackedCompetitors, userCompanies } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export default async function RootPage() {
  const company = await db.query.userCompanies.findFirst({
    where: eq(userCompanies.confirmed, true),
  });

  if (!company) {
    redirect("/setup/company");
  }

  const competitors = await db
    .select()
    .from(trackedCompetitors)
    .where(eq(trackedCompetitors.userCompanyId, company.id))
    .limit(1);

  if (competitors.length === 0) {
    redirect("/setup/competitors");
  }

  redirect("/feed");
}
