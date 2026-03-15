import { db } from "@/lib/db";
import { events, relevanceScores } from "@/lib/db/schema";
import type { TrackedCompetitor, UserCompany } from "@/lib/db/schema";
import { searchWebMentions } from "@/lib/services/webSearch";
import { scoreArticles } from "@/lib/services/openai";
import { getCompanyProducts } from "@/lib/services/companyProducts";
import { computeRecencyPenalty, computeFinalScore } from "@/lib/scoring";

export async function runWebSearchModule(
  competitor: TrackedCompetitor,
  company: UserCompany
): Promise<void> {
  const companyProductList = await getCompanyProducts(company.id);
  const results = await searchWebMentions(competitor.name);
  if (results.length === 0) return;

  const payload = results.map((r, i) => ({
    index: i,
    title: r.title,
    description: r.description,
    url: r.url,
    publishedAt: r.publishedAt,
  }));

  const scores = await scoreArticles(
    company,
    competitor.name,
    competitor.domain,
    payload,
    companyProductList
  );

  for (const score of scores) {
    const result = results[score.index];
    if (!result) continue;
    if (score.is_noise) continue;

    const signalStrength = typeof score.signal_strength === "number" ? score.signal_strength : 0;
    const sentimentScore = typeof score.sentiment_score === "number" ? score.sentiment_score : 0;

    const eventDate = new Date(result.publishedAt);
    const recencyPenalty = computeRecencyPenalty(eventDate);
    if (recencyPenalty === -100) continue;

    const finalScore = computeFinalScore(
      signalStrength,
      recencyPenalty,
      sentimentScore
    );
    if (finalScore < 25) continue;

    const inserted = await db
      .insert(events)
      .values({
        competitorId: competitor.id,
        moduleType: "review",
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
      signalStrength,
      signalReasoning: score.signal_reasoning ?? "",
      sentimentLabel: score.sentiment_label ?? "Neutral",
      sentimentScore: String(sentimentScore),
      summary: score.summary ?? "",
      isNoise: false,
      recencyPenalty,
      finalScore,
    });
  }
}
