import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { companyProducts, relevanceScores, userCompanies } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000001";

/**
 * Returns a map of product title → event count for all company products.
 * Uses the JSONB `?` operator to count events whose matchedProducts contain each title.
 */
export async function GET() {
  const company = await db.query.userCompanies.findFirst({
    where: eq(userCompanies.userId, DEFAULT_USER_ID),
  });
  if (!company) return NextResponse.json({});

  const products = await db
    .select({ id: companyProducts.id, title: companyProducts.title })
    .from(companyProducts)
    .where(eq(companyProducts.userCompanyId, company.id));

  if (products.length === 0) return NextResponse.json({});

  // Single query: count events per product title using JSONB containment
  const counts: Record<string, number> = {};
  for (const p of products) {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(relevanceScores)
      .where(sql`${relevanceScores.matchedProducts}::jsonb ? ${p.title}`);
    counts[p.id] = Number(result.count);
  }

  return NextResponse.json(counts);
}
