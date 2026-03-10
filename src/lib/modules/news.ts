import { db } from "@/lib/db";
import { events, relevanceScores } from "@/lib/db/schema";
import type { TrackedCompetitor, UserCompany } from "@/lib/db/schema";
import { fetchCompetitorNews } from "@/lib/services/newsapi";
import { scoreArticles } from "@/lib/services/openai";
import { computeRecencyPenalty, computeFinalScore } from "@/lib/scoring";

const MIN_FINAL_SCORE = 25;

export async function runNewsModule(
  competitor: TrackedCompetitor,
  company: UserCompany
): Promise<void> {
  const articles = await fetchCompetitorNews(competitor.name);
  if (articles.length === 0) return;

  const payload = articles.map((a, i) => ({
    index: i,
    title: a.title,
    description: a.description ?? "",
    url: a.url,
    publishedAt: a.publishedAt,
  }));

  const scores = await scoreArticles(
    company,
    competitor.name,
    competitor.domain,
    payload
  );

  for (const score of scores) {
    const article = articles[score.index];
    if (!article) continue;
    if (score.is_noise) continue;

    const recencyPenalty = computeRecencyPenalty(new Date(article.publishedAt));
    if (recencyPenalty === -100) continue; // 90+ days old

    const finalScore = computeFinalScore(
      score.signal_strength,
      recencyPenalty,
      score.sentiment_score
    );
    if (finalScore < MIN_FINAL_SCORE) continue;

    const inserted = await db
      .insert(events)
      .values({
        competitorId: competitor.id,
        moduleType: "news",
        title: article.title,
        sourceUrl: article.url,
        eventOccurredAt: new Date(article.publishedAt),
        rawData: article,
        externalId: article.url,
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
