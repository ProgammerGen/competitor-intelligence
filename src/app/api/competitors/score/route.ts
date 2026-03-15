import { NextRequest, NextResponse } from "next/server";
import { scoreCompetitor } from "@/lib/services/openai";
import { db } from "@/lib/db";
import { userCompanies } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000001";

export async function POST(req: NextRequest) {
  const { name, domain } = (await req.json()) as {
    name: string;
    domain: string;
  };

  if (!name?.trim() || !domain?.trim()) {
    return NextResponse.json(
      { error: "name and domain are required" },
      { status: 400 }
    );
  }

  const company = await db.query.userCompanies.findFirst({
    where: eq(userCompanies.userId, DEFAULT_USER_ID),
  });
  if (!company) {
    return NextResponse.json(
      { error: "No company profile found" },
      { status: 404 }
    );
  }

  const result = await scoreCompetitor(
    {
      name: company.name,
      description: company.description,
      industry: company.industry,
      targetCustomer: company.targetCustomer,
      whyCustomersBuy: company.whyCustomersBuy,
    },
    name.trim(),
    domain.trim()
  );

  return NextResponse.json(result);
}
