import { db } from "@/lib/db";
import { events, productSnapshots, relevanceScores } from "@/lib/db/schema";
import type { TrackedCompetitor, UserCompany, CompanyProduct } from "@/lib/db/schema";
import { fetchShopifyProducts } from "@/lib/services/shopify";
import { searchProductMentions } from "@/lib/services/webSearch";
import { scoreProducts, type ArticleScoreResult } from "@/lib/services/openai";
import { getCompanyProducts } from "@/lib/services/companyProducts";
import { computeRecencyPenalty, computeFinalScore } from "@/lib/scoring";
import { and, desc, eq, lt } from "drizzle-orm";

const BATCH_SIZE = 20;

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

type ProductPayload = {
  index: number;
  title: string;
  description: string;
  price: string;
  variantCount: number;
  url: string;
  launchedAt: string;
};

export async function runProductsModule(
  competitor: TrackedCompetitor,
  company: UserCompany
): Promise<void> {
  console.log(`[products] Starting for ${competitor.name} (${competitor.domain})`);

  const companyProductList = await getCompanyProducts(company.id);
  const products = await fetchShopifyProducts(competitor.domain);
  console.log(`[products] Fetched ${products.length} products from ${competitor.domain}`);

  // Fallback: if no products found via normal strategies, search Tavily for product mentions
  if (products.length === 0) {
    console.log(`[products] No products found, trying Tavily fallback for ${competitor.name}`);
    await runTavilyProductFallback(competitor, company, companyProductList);
    return;
  }

  const [latestSnapshot] = await db
    .select()
    .from(productSnapshots)
    .where(eq(productSnapshots.competitorId, competitor.id))
    .orderBy(desc(productSnapshots.syncedAt))
    .limit(1);

  const knownIds = new Set(
    (latestSnapshot?.products ?? []).map((p) => p.id)
  );
  console.log(`[products] Snapshot has ${knownIds.size} known product IDs`);

  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

  // Include products that are either new since last snapshot OR launched within the past year
  const productsToProcess = products.filter((p) => {
    const isNew = !knownIds.has(p.id);
    const launchedWithinYear = new Date(p.created_at) >= oneYearAgo;
    return isNew || launchedWithinYear;
  });
  console.log(`[products] ${productsToProcess.length} products to process (new or launched within 1 year)`);

  // Store full snapshot (always, for diffing)
  await db.insert(productSnapshots).values({
    competitorId: competitor.id,
    products,
  });

  // Prune snapshots older than 30 days (keep delta history in events table)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  await db
    .delete(productSnapshots)
    .where(
      and(
        eq(productSnapshots.competitorId, competitor.id),
        lt(productSnapshots.syncedAt, thirtyDaysAgo)
      )
    );

  if (productsToProcess.length === 0) {
    console.log(`[products] No products to process, skipping scoring`);
    return;
  }

  // Build rich product descriptions for the LLM
  const productsPayload: ProductPayload[] = productsToProcess.map((p, i) => {
    const prices = (p.variants ?? [])
      .map((v) => parseFloat(v.price))
      .filter((pr) => !isNaN(pr) && pr > 0);
    const priceRange =
      prices.length === 0
        ? "Price not available"
        : prices.length === 1
        ? `$${prices[0].toFixed(2)}`
        : `$${Math.min(...prices).toFixed(2)} – $${Math.max(...prices).toFixed(2)}`;

    const variantNames = (p.variants ?? [])
      .map((v) => v.title)
      .filter((t) => t && t !== "Default Title")
      .slice(0, 5);

    // Build a rich description from all available product data
    const descParts: string[] = [];
    if (p.body_html) {
      const plainText = stripHtml(p.body_html);
      if (plainText.length > 0) {
        descParts.push(plainText.slice(0, 300));
      }
    }
    if (p.product_type) {
      descParts.push(`Type: ${p.product_type}`);
    }
    if (p.tags && p.tags.length > 0) {
      descParts.push(`Tags: ${p.tags.slice(0, 8).join(", ")}`);
    }
    if (variantNames.length > 0) {
      descParts.push(`Variants: ${variantNames.join(", ")}`);
    }

    return {
      index: i,
      title: p.title,
      description: descParts.length > 0 ? descParts.join(". ") : p.title,
      price: priceRange,
      variantCount: p.variants?.length ?? 0,
      url: `https://${competitor.domain}/products/${p.handle}`,
      launchedAt: p.created_at,
    };
  });

  // Score in batches of BATCH_SIZE to avoid AI dropping the index field on large inputs
  const allScores = await scoreBatched(productsPayload, company, competitor, companyProductList);
  console.log(`[products] Total scores received: ${allScores.length} for ${productsToProcess.length} products`);

  let insertedCount = 0;
  let skippedCount = 0;

  for (const score of allScores) {
    const product = productsToProcess[score.index];
    if (!product) {
      console.warn(`[products] Score index ${score.index} has no matching product, skipping`);
      continue;
    }

    const eventDate = new Date(product.created_at);

    const inserted = await db
      .insert(events)
      .values({
        competitorId: competitor.id,
        moduleType: "product_launch",
        title: product.title,
        sourceUrl: `https://${competitor.domain}/products/${product.handle}`,
        eventOccurredAt: eventDate,
        rawData: product,
        externalId: String(product.id),
      })
      .onConflictDoNothing()
      .returning({ id: events.id });

    if (inserted.length === 0) {
      skippedCount++;
      continue;
    }

    // For products: cap recency penalty at -30 so items up to 1 year old still appear in feed
    const rawPenalty = computeRecencyPenalty(eventDate);
    const recencyPenalty = rawPenalty === -100 ? -30 : rawPenalty;

    const finalScore = computeFinalScore(
      score.signal_strength,
      recencyPenalty,
      score.sentiment_score
    );

    // Products are NEVER noise — every launch is relevant competitive intelligence
    await db.insert(relevanceScores).values({
      eventId: inserted[0].id,
      signalStrength: score.signal_strength ?? 0,
      signalReasoning: score.signal_reasoning ?? "",
      sentimentLabel: score.sentiment_label ?? "Neutral",
      sentimentScore: String(score.sentiment_score ?? 0),
      summary: score.summary ?? "",
      isNoise: false,
      matchedProducts: score.matched_products ?? null,
      recencyPenalty,
      finalScore,
    });

    insertedCount++;
  }

  console.log(`[products] Done for ${competitor.name}: ${insertedCount} inserted, ${skippedCount} skipped (already existed)`);
}

/**
 * Score products in batches of BATCH_SIZE, re-mapping indices back to the
 * original productsPayload positions. If the AI omits the `index` field,
 * fall back to the position within the batch.
 */
async function scoreBatched(
  productsPayload: ProductPayload[],
  company: UserCompany,
  competitor: TrackedCompetitor,
  companyProductList?: CompanyProduct[]
): Promise<ArticleScoreResult[]> {
  const allScores: ArticleScoreResult[] = [];

  for (let start = 0; start < productsPayload.length; start += BATCH_SIZE) {
    const batch = productsPayload.slice(start, start + BATCH_SIZE);

    // Re-index the batch from 0 so the AI sees a clean 0..N-1 range
    const batchForAI = batch.map((p, i) => ({ ...p, index: i }));

    console.log(`[products] Scoring batch ${start}-${start + batch.length - 1} (${batch.length} items) for ${competitor.name}`);

    let scores: ArticleScoreResult[];
    try {
      scores = await scoreProducts(
        company,
        competitor.name,
        competitor.domain,
        batchForAI,
        companyProductList
      );
    } catch (err) {
      console.error(`[products] AI scoring failed for batch ${start}-${start + batch.length - 1} of ${competitor.name}:`, err);
      throw err;
    }

    // Re-map indices: if AI returned an index, map it back to the original;
    // if index is undefined/null, use the position in the results array
    for (let i = 0; i < scores.length; i++) {
      const score = scores[i];
      const batchIndex = score.index ?? i;
      // Map batch-local index back to the global productsPayload index
      const globalIndex = start + batchIndex;
      allScores.push({ ...score, index: globalIndex });
    }

    console.log(`[products] Batch returned ${scores.length} scores`);
  }

  return allScores;
}

async function runTavilyProductFallback(
  competitor: TrackedCompetitor,
  company: UserCompany,
  companyProductList?: CompanyProduct[]
): Promise<void> {
  const results = await searchProductMentions(competitor.name, competitor.domain);
  console.log(`[products/tavily] Found ${results.length} product mentions for ${competitor.name}`);
  if (results.length === 0) return;

  const payload: ProductPayload[] = results.map((r, i) => ({
    index: i,
    title: r.title,
    description: r.description ?? r.title,
    price: "Price not available",
    variantCount: 0,
    url: r.url,
    launchedAt: r.publishedAt,
  }));

  // Tavily results are already small (≤20), but batch for consistency
  const allScores = await scoreBatched(payload, company, competitor, companyProductList);

  for (const score of allScores) {
    const result = results[score.index];
    if (!result) continue;

    const eventDate = new Date(result.publishedAt);
    const rawPenalty = computeRecencyPenalty(eventDate);
    const recencyPenalty = rawPenalty === -100 ? -30 : rawPenalty;
    const finalScore = computeFinalScore(score.signal_strength, recencyPenalty, score.sentiment_score);

    const inserted = await db
      .insert(events)
      .values({
        competitorId: competitor.id,
        moduleType: "product_launch",
        title: result.title,
        sourceUrl: result.url,
        eventOccurredAt: eventDate,
        rawData: result,
        externalId: result.url,
      })
      .onConflictDoNothing()
      .returning({ id: events.id });

    if (inserted.length === 0) continue;

    await db.insert(relevanceScores).values({
      eventId: inserted[0].id,
      signalStrength: score.signal_strength ?? 0,
      signalReasoning: score.signal_reasoning ?? "",
      sentimentLabel: score.sentiment_label ?? "Neutral",
      sentimentScore: String(score.sentiment_score ?? 0),
      summary: score.summary ?? "",
      isNoise: false,
      matchedProducts: score.matched_products ?? null,
      recencyPenalty,
      finalScore,
    });
  }
}
