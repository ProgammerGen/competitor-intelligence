import { db } from "@/lib/db";
import { events, productSnapshots, relevanceScores } from "@/lib/db/schema";
import type { TrackedCompetitor, UserCompany } from "@/lib/db/schema";
import { fetchShopifyProducts } from "@/lib/services/shopify";
import { scoreArticles } from "@/lib/services/openai";
import { computeRecencyPenalty, computeFinalScore } from "@/lib/scoring";
import { and, desc, eq, lt } from "drizzle-orm";

export async function runProductsModule(
  competitor: TrackedCompetitor,
  company: UserCompany
): Promise<void> {
  const products = await fetchShopifyProducts(competitor.domain);
  if (products.length === 0) return;

  const [latestSnapshot] = await db
    .select()
    .from(productSnapshots)
    .where(eq(productSnapshots.competitorId, competitor.id))
    .orderBy(desc(productSnapshots.syncedAt))
    .limit(1);

  const knownIds = new Set(
    (latestSnapshot?.products ?? []).map((p) => p.id)
  );
  const newProducts = products.filter((p) => !knownIds.has(p.id));

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

  if (newProducts.length === 0) return;

  // Score new products in one batched LLM call
  const articlesPayload = newProducts.map((p, i) => ({
    index: i,
    title: p.title,
    description: `${p.variants[0]?.title ?? ""} — $${p.variants[0]?.price ?? ""}`,
    url: `https://${competitor.domain}/products/${p.handle}`,
    publishedAt: p.created_at,
  }));

  const scores = await scoreArticles(
    company,
    competitor.name,
    competitor.domain,
    articlesPayload
  );

  for (const score of scores) {
    const product = newProducts[score.index];
    if (!product) continue;

    const inserted = await db
      .insert(events)
      .values({
        competitorId: competitor.id,
        moduleType: "product_launch",
        title: product.title,
        sourceUrl: `https://${competitor.domain}/products/${product.handle}`,
        eventOccurredAt: new Date(product.created_at),
        rawData: product,
        externalId: String(product.id),
      })
      .onConflictDoNothing()
      .returning({ id: events.id });

    if (inserted.length === 0) continue; // already exists, skip scoring

    const recencyPenalty = computeRecencyPenalty(new Date(product.created_at));
    const finalScore = computeFinalScore(
      score.signal_strength,
      recencyPenalty,
      score.sentiment_score
    );

    await db.insert(relevanceScores).values({
      eventId: inserted[0].id,
      signalStrength: score.signal_strength ?? 0,
      signalReasoning: score.signal_reasoning ?? "",
      sentimentLabel: score.sentiment_label ?? "Neutral",
      sentimentScore: String(score.sentiment_score ?? 0),
      summary: score.summary ?? "",
      isNoise: score.is_noise ?? false,
      recencyPenalty,
      finalScore,
    });
  }
}
