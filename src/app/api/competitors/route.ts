import { NextRequest, NextResponse } from "next/server";
import { discoverCompetitors } from "@/lib/services/openai";
import { db } from "@/lib/db";
import { trackedCompetitors, userCompanies } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000001";

// Discover competitors from the saved company profile
export async function POST() {
  const company = await db.query.userCompanies.findFirst({
    where: eq(userCompanies.userId, DEFAULT_USER_ID),
  });
  if (!company) {
    return NextResponse.json({ error: "No company profile found" }, { status: 404 });
  }

  const suggestions = await discoverCompetitors({
    name: company.name,
    description: company.description,
    industry: company.industry,
    targetCustomer: company.targetCustomer,
    whyCustomersBuy: company.whyCustomersBuy,
  });

  return NextResponse.json(suggestions);
}

// Save confirmed competitor list
export async function PUT(req: NextRequest) {
  const company = await db.query.userCompanies.findFirst({
    where: eq(userCompanies.userId, DEFAULT_USER_ID),
  });
  if (!company) {
    return NextResponse.json({ error: "No company profile found" }, { status: 404 });
  }

  const competitors = (await req.json()) as Array<{
    name: string;
    domain: string;
    similarityScore: number;
    whySimilar: string;
  }>;

  const inserted = await db
    .insert(trackedCompetitors)
    .values(
      competitors.map((c) => ({
        userCompanyId: company.id,
        name: c.name,
        domain: c.domain,
        similarityScore: c.similarityScore,
        whySimilar: c.whySimilar,
      }))
    )
    .onConflictDoNothing()
    .returning();

  return NextResponse.json(inserted);
}

export async function GET() {
  const company = await db.query.userCompanies.findFirst({
    where: eq(userCompanies.userId, DEFAULT_USER_ID),
  });
  if (!company) return NextResponse.json([]);

  const competitors = await db
    .select()
    .from(trackedCompetitors)
    .where(eq(trackedCompetitors.userCompanyId, company.id));

  return NextResponse.json(competitors);
}
