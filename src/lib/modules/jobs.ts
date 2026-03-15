import * as cheerio from "cheerio";
import { db } from "@/lib/db";
import { events, relevanceScores } from "@/lib/db/schema";
import type { TrackedCompetitor, UserCompany } from "@/lib/db/schema";
import { summarizeJob } from "@/lib/services/openai";
import { getCompanyProducts } from "@/lib/services/companyProducts";
import { computeRecencyPenalty, computeFinalScore } from "@/lib/scoring";

const CAREERS_PATHS = ["/jobs", "/careers", "/about/careers", "/work-with-us"];

interface JobListing {
  title: string;
  url: string;
  text: string;
}

async function fetchJobListings(domain: string): Promise<JobListing[]> {
  for (const path of CAREERS_PATHS) {
    try {
      const res = await fetch(`https://${domain}${path}`, {
        signal: AbortSignal.timeout(8000),
        headers: { "User-Agent": "Mozilla/5.0 (compatible; CompetitorIntel/1.0)" },
      });
      if (!res.ok) continue;

      const html = await res.text();
      const $ = cheerio.load(html);
      const jobs: JobListing[] = [];

      // Look for common job listing patterns
      $("a").each((_, el) => {
        const href = $(el).attr("href") ?? "";
        const text = $(el).text().trim();
        if (
          text.length > 10 &&
          text.length < 150 &&
          (href.includes("job") ||
            href.includes("career") ||
            href.includes("position") ||
            href.includes("role") ||
            href.includes("opening"))
        ) {
          const url = href.startsWith("http")
            ? href
            : `https://${domain}${href}`;
          jobs.push({ title: text, url, text: "" });
        }
      });

      if (jobs.length > 0) return jobs.slice(0, 20);
    } catch {
      continue;
    }
  }
  return [];
}

export async function runJobsModule(
  competitor: TrackedCompetitor,
  company: UserCompany
): Promise<void> {
  const companyProductList = await getCompanyProducts(company.id);
  const listings = await fetchJobListings(competitor.domain);
  if (listings.length === 0) return;

  for (const job of listings) {
    // Check if already exists before making LLM call
    const existing = await db.query.events.findFirst({
      where: (e, { and, eq }) =>
        and(
          eq(e.competitorId, competitor.id),
          eq(e.moduleType, "job_posting"),
          eq(e.externalId, job.url)
        ),
    });
    if (existing) continue;

    const score = await summarizeJob(
      company,
      competitor.name,
      competitor.domain,
      job.title,
      job.text || job.title,
      companyProductList
    );

    const signalStrength = typeof score.signal_strength === "number" ? score.signal_strength : 0;
    const sentimentScore = typeof score.sentiment_score === "number" ? score.sentiment_score : 0;

    if (score.is_noise || signalStrength < 20) continue;

    const now = new Date();
    const recencyPenalty = computeRecencyPenalty(now);
    const finalScore = computeFinalScore(signalStrength, recencyPenalty, sentimentScore);

    const inserted = await db
      .insert(events)
      .values({
        competitorId: competitor.id,
        moduleType: "job_posting",
        title: job.title,
        sourceUrl: job.url,
        eventOccurredAt: now,
        rawData: job,
        externalId: job.url,
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
