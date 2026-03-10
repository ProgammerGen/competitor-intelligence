import { db } from "@/lib/db";
import { events, relevanceScores } from "@/lib/db/schema";
import type { TrackedCompetitor, UserCompany } from "@/lib/db/schema";
import { searchRedditPosts } from "@/lib/services/reddit";
import { scoreRedditPosts } from "@/lib/services/openai";
import { computeRecencyPenalty, computeFinalScore } from "@/lib/scoring";

export async function runRedditModule(
  competitor: TrackedCompetitor,
  company: UserCompany
): Promise<void> {
  const posts = await searchRedditPosts(competitor.name, company.industry);
  if (posts.length === 0) return;

  const payload = posts.map((p, i) => ({
    index: i,
    id: p.id,
    title: p.title,
    selftext: p.selftext.length > 50 ? p.selftext.slice(0, 1000) : "",
    score: p.score,
    subreddit: p.subreddit,
  }));

  const scores = await scoreRedditPosts(
    company,
    competitor.name,
    competitor.domain,
    payload
  );

  for (const score of scores) {
    const post = posts[score.index];
    if (!post) continue;
    if (score.is_noise) continue;

    const eventDate = new Date(post.created_utc * 1000);
    const recencyPenalty = computeRecencyPenalty(eventDate);
    if (recencyPenalty === -100) continue;

    const finalScore = computeFinalScore(
      score.signal_strength,
      recencyPenalty,
      score.sentiment_score
    );
    if (finalScore < 25) continue;

    const permalink = `https://reddit.com${post.permalink}`;

    const inserted = await db
      .insert(events)
      .values({
        competitorId: competitor.id,
        moduleType: "review",
        title: post.title,
        sourceUrl: permalink,
        eventOccurredAt: eventDate,
        rawData: post,
        externalId: post.id,
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
