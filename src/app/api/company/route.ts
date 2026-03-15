import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { enrichCompany } from "@/lib/services/openai";
import { syncCompanyProducts } from "@/lib/services/companyProducts";
import { db } from "@/lib/db";
import {
  userCompanies,
  users,
  trackedCompetitors,
  companyProducts,
  events,
  relevanceScores,
  moduleRuns,
  productSnapshots,
} from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000001";

export async function POST(req: NextRequest) {
  const { domain } = (await req.json()) as { domain: string };
  if (!domain) {
    return NextResponse.json({ error: "domain required" }, { status: 400 });
  }

  let homepageText = "";
  try {
    const res = await fetch(`https://${domain}`, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CompetitorIntel/1.0)" },
    });
    if (res.ok) {
      const html = await res.text();
      const $ = cheerio.load(html);
      $("script, style, nav, footer").remove();
      homepageText = $("body").text().replace(/\s+/g, " ").trim();
    }
  } catch {
    // If fetch fails, LLM uses its training knowledge about the domain
  }

  const profile = await enrichCompany(domain, homepageText);
  return NextResponse.json(profile);
}

export async function PUT(req: NextRequest) {
  const body = (await req.json()) as {
    domain: string;
    name: string;
    description: string;
    industry: string;
    targetCustomer: { ageRange: string; geography: string; traits: string[] };
    whyCustomersBuy: string;
  };

  await db.insert(users).values({ id: DEFAULT_USER_ID }).onConflictDoNothing();

  const existing = await db.query.userCompanies.findFirst({
    where: eq(userCompanies.userId, DEFAULT_USER_ID),
  });

  let result;
  if (existing) {
    [result] = await db
      .update(userCompanies)
      .set({ ...body, confirmed: true })
      .where(eq(userCompanies.userId, DEFAULT_USER_ID))
      .returning();
  } else {
    [result] = await db
      .insert(userCompanies)
      .values({ ...body, userId: DEFAULT_USER_ID, confirmed: true })
      .returning();
  }

  // Auto-fetch company products in background after confirmation
  after(async () => {
    try {
      const count = await syncCompanyProducts(result);
      console.log(`[company] Synced ${count} products for ${result.domain}`);
    } catch (err) {
      console.error("[company] Product sync failed:", err);
    }
  });

  return NextResponse.json(result);
}

export async function GET() {
  const company = await db.query.userCompanies.findFirst({
    where: eq(userCompanies.userId, DEFAULT_USER_ID),
  });
  return NextResponse.json(company ?? null);
}

export async function DELETE() {
  const company = await db.query.userCompanies.findFirst({
    where: eq(userCompanies.userId, DEFAULT_USER_ID),
  });
  if (!company) return NextResponse.json({ ok: true });

  const competitors = await db
    .select({ id: trackedCompetitors.id })
    .from(trackedCompetitors)
    .where(eq(trackedCompetitors.userCompanyId, company.id));

  for (const c of competitors) {
    const eventIds = await db
      .select({ id: events.id })
      .from(events)
      .where(eq(events.competitorId, c.id));

    if (eventIds.length > 0) {
      await db.delete(relevanceScores).where(
        inArray(relevanceScores.eventId, eventIds.map((e) => e.id))
      );
    }
    await db.delete(events).where(eq(events.competitorId, c.id));
    await db.delete(moduleRuns).where(eq(moduleRuns.competitorId, c.id));
    await db.delete(productSnapshots).where(eq(productSnapshots.competitorId, c.id));
  }

  await db.delete(companyProducts).where(eq(companyProducts.userCompanyId, company.id));
  await db.delete(trackedCompetitors).where(eq(trackedCompetitors.userCompanyId, company.id));
  await db.delete(userCompanies).where(eq(userCompanies.id, company.id));

  return NextResponse.json({ ok: true });
}
