import { db } from "@/lib/db";
import { events, productSnapshots, relevanceScores } from "@/lib/db/schema";
import type { TrackedCompetitor, UserCompany } from "@/lib/db/schema";
import { fetchShopifyProducts } from "@/lib/services/shopify";
import { searchProductMentions } from "@/lib/services/webSearch";
import { scoreArticles } from "@/lib/services/openai";
import { computeRecencyPenalty, computeFinalScore } from "@/lib/scoring";
import { and, desc, eq, lt } from "drizzle-orm";

export async function runProductsModule(
  competitor: TrackedCompetitor,
  company: UserCompany
): Promise<void> {
  const products = await fetchShopifyProducts(competitor.domain);

  // Fallback: if no products found via normal strategies, search Tavily for product mentions
  if (products.length === 0) {
    await runTavilyProductFallback(competitor, company);
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

  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

  // Include products that are either new since last snapshot OR launched within the past year
  const productsToProcess = products.filter((p) => {
    const isNew = !knownIds.has(p.id);
    const launchedWithinYear = new Date(p.created_at) >= oneYearAgo;
    return isNew || launchedWithinYear;
  });

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

  if (productsToProcess.length === 0) return;

  // Score products in one batched LLM call
  const articlesPayload = productsToProcess.map((p, i) => ({
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
    const product = productsToProcess[score.index];
    if (!product) continue;

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

    if (inserted.length === 0) continue; // already exists, skip scoring

    // For products: cap recency penalty at -30 so items up to 1 year old still appear in feed
    const rawPenalty = computeRecencyPenalty(eventDate);
    const recencyPenalty = rawPenalty === -100 ? -30 : rawPenalty;

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

async function runTavilyProductFallback(
  competitor: TrackedCompetitor,
  company: UserCompany
): Promise<void> {
  const results = await searchProductMentions(competitor.name, competitor.domain);
  if (results.length === 0) return;

  const payload = results.map((r, i) => ({
    index: i,
    title: r.title,
    description: r.description,
    url: r.url,
    publishedAt: r.publishedAt,
  }));

  const scores = await scoreArticles(company, competitor.name, competitor.domain, payload);

  for (const score of scores) {
    const result = results[score.index];
    if (!result || score.is_noise) continue;

    const eventDate = new Date(result.publishedAt);
    const rawPenalty = computeRecencyPenalty(eventDate);
    const recencyPenalty = rawPenalty === -100 ? -30 : rawPenalty;
    const finalScore = computeFinalScore(score.signal_strength, recencyPenalty, score.sentiment_score);
    if (finalScore < 25) continue;

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
      recencyPenalty,
      finalScore,
    });
  }
}
