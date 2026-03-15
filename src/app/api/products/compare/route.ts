import { NextRequest, NextResponse } from "next/server";
import { compareProducts } from "@/lib/services/openai";
import { db } from "@/lib/db";
import { userCompanies, companyProducts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000001";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    companyProductName: string;
    competitorProductTitle?: string;
    competitorProductDescription?: string;
    competitorProductPrice?: string;
    competitorName: string;
    moduleType: string;
    eventSummary: string;
  };

  if (!body.companyProductName?.trim() || !body.competitorName?.trim()) {
    return NextResponse.json(
      { error: "companyProductName and competitorName are required" },
      { status: 400 }
    );
  }

  const company = await db.query.userCompanies.findFirst({
    where: eq(userCompanies.userId, DEFAULT_USER_ID),
  });

  if (!company) {
    return NextResponse.json({ error: "No company profile found" }, { status: 404 });
  }

  // Look up the company product by name
  const allProducts = await db
    .select()
    .from(companyProducts)
    .where(eq(companyProducts.userCompanyId, company.id));

  const matchedProduct = allProducts.find(
    (p) => p.title === body.companyProductName
  );

  const result = await compareProducts({
    companyName: company.name,
    companyProduct: matchedProduct
      ? {
          title: matchedProduct.title,
          description: matchedProduct.description,
          price: matchedProduct.price,
          productType: matchedProduct.productType,
        }
      : { title: body.companyProductName },
    competitorName: body.competitorName,
    competitorProduct:
      body.moduleType === "product_launch" && body.competitorProductTitle
        ? {
            title: body.competitorProductTitle,
            description: body.competitorProductDescription ?? null,
            price: body.competitorProductPrice ?? null,
          }
        : null,
    moduleType: body.moduleType,
    eventSummary: body.eventSummary || "",
  });

  return NextResponse.json(result);
}
