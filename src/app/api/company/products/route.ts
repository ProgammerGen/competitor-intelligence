import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { companyProducts, userCompanies } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { syncCompanyProducts } from "@/lib/services/companyProducts";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000001";

async function getCompany() {
  return db.query.userCompanies.findFirst({
    where: eq(userCompanies.userId, DEFAULT_USER_ID),
  });
}

export async function GET() {
  const company = await getCompany();
  if (!company) return NextResponse.json([]);

  const products = await db
    .select()
    .from(companyProducts)
    .where(eq(companyProducts.userCompanyId, company.id));

  return NextResponse.json(products);
}

export async function POST(req: NextRequest) {
  const company = await getCompany();
  if (!company) {
    return NextResponse.json({ error: "No company found" }, { status: 404 });
  }

  const { title, description, price } = (await req.json()) as {
    title: string;
    description?: string;
    price?: string;
  };

  if (!title?.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const [product] = await db
    .insert(companyProducts)
    .values({
      userCompanyId: company.id,
      title: title.trim(),
      description: description?.trim() || null,
      price: price?.trim() || null,
      sourceType: "manual",
      externalId: randomUUID(),
    })
    .returning();

  return NextResponse.json(product);
}

export async function PUT() {
  const company = await getCompany();
  if (!company) {
    return NextResponse.json({ error: "No company found" }, { status: 404 });
  }

  after(async () => {
    try {
      const count = await syncCompanyProducts(company);
      console.log(`[company/products] Re-synced ${count} products for ${company.domain}`);
    } catch (err) {
      console.error("[company/products] Re-sync failed:", err);
    }
  });

  return NextResponse.json({ status: "sync_triggered" });
}

export async function DELETE(req: NextRequest) {
  const { id } = (await req.json()) as { id: string };
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  await db.delete(companyProducts).where(eq(companyProducts.id, id));
  return NextResponse.json({ ok: true });
}
