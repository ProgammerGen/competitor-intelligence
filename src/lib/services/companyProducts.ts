import { db } from "@/lib/db";
import { companyProducts } from "@/lib/db/schema";
import type { UserCompany, CompanyProduct } from "@/lib/db/schema";
import { fetchShopifyProducts } from "@/lib/services/shopify";
import { and, eq } from "drizzle-orm";

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#\d+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function computePriceRange(variants: Array<{ price: string; title: string }>): string | null {
  const prices = variants
    .map((v) => parseFloat(v.price))
    .filter((p) => !isNaN(p) && p > 0);
  if (prices.length === 0) return null;
  if (prices.length === 1) return `$${prices[0].toFixed(2)}`;
  return `$${Math.min(...prices).toFixed(2)} – $${Math.max(...prices).toFixed(2)}`;
}

/**
 * Fetch and sync auto-detected products for the user's own company.
 * Deletes previous auto-fetched products and replaces with fresh data.
 * Manual products are preserved.
 */
export async function syncCompanyProducts(company: UserCompany): Promise<number> {
  console.log(`[companyProducts] Syncing products for ${company.name} (${company.domain})`);

  const shopifyProducts = await fetchShopifyProducts(company.domain);
  console.log(`[companyProducts] Fetched ${shopifyProducts.length} products from ${company.domain}`);

  if (shopifyProducts.length === 0) {
    console.log(`[companyProducts] No products found, skipping (manual products preserved)`);
    return 0;
  }

  // Clear previous auto-fetched products (manual ones are preserved)
  await db
    .delete(companyProducts)
    .where(
      and(
        eq(companyProducts.userCompanyId, company.id),
        eq(companyProducts.sourceType, "auto")
      )
    );

  const rows = shopifyProducts.map((p) => ({
    userCompanyId: company.id,
    title: p.title,
    handle: p.handle,
    description: p.body_html ? stripHtml(p.body_html).slice(0, 500) : null,
    price: computePriceRange(p.variants),
    imageUrl: p.images?.[0]?.src ?? null,
    productType: p.product_type ?? null,
    sourceType: "auto" as const,
    externalId: String(p.id),
  }));

  const inserted = await db
    .insert(companyProducts)
    .values(rows)
    .onConflictDoNothing()
    .returning({ id: companyProducts.id });

  console.log(`[companyProducts] Synced ${inserted.length} products for ${company.name}`);
  return inserted.length;
}

/**
 * Get all company products (auto + manual) for use in AI scoring context.
 */
export async function getCompanyProducts(userCompanyId: string): Promise<CompanyProduct[]> {
  return db
    .select()
    .from(companyProducts)
    .where(eq(companyProducts.userCompanyId, userCompanyId));
}
