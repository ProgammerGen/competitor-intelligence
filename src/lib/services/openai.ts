import OpenAI from "openai";
import type { UserCompany } from "@/lib/db/schema";

function getClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export interface CompanyProfile {
  name: string;
  description: string;
  industry: string;
  targetCustomer: { ageRange: string; geography: string; traits: string[] };
  whyCustomersBuy: string;
}

export interface CompetitorSuggestion {
  name: string;
  domain: string;
  similarityScore: number;
  whySimilar: string;
}

export interface ArticleScoreResult {
  index: number;
  signal_strength: number;
  signal_reasoning: string;
  sentiment_label: "Positive" | "Neutral" | "Negative";
  sentiment_score: number;
  summary: string;
  is_noise: boolean;
}

function buildCompanyContext(
  company: UserCompany,
  competitorName: string,
  competitorDomain: string
): string {
  return `Company: ${company.name} | Industry: ${company.industry}
Target Customer: Age ${company.targetCustomer.ageRange}, ${company.targetCustomer.geography}, traits: ${company.targetCustomer.traits.join(", ")}
Why Customers Buy: ${company.whyCustomersBuy}
Analyzing competitor: ${competitorName} (${competitorDomain})`;
}

export async function enrichCompany(
  domain: string,
  homepageText: string
): Promise<CompanyProfile> {
  const response = await getClient().chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are a business analyst. Extract a structured company profile from the provided website text and domain. Return JSON with exactly these keys: name (string), description (2-3 sentence summary), industry (one of: E-commerce, Beauty, Apparel, Health & Wellness, Home & Living, Food & Beverage, Technology, Sports & Outdoors, Other), targetCustomer (object with ageRange string, geography string, traits string array of 2-3 items), whyCustomersBuy (1-2 sentences on their value proposition). If the site has little content, use your knowledge of the domain.",
      },
      {
        role: "user",
        content: `Domain: ${domain}\n\nWebsite content:\n${homepageText.slice(0, 8000)}`,
      },
    ],
  });

  const raw = response.choices[0].message.content ?? "{}";
  return JSON.parse(raw) as CompanyProfile;
}

export async function discoverCompetitors(
  company: CompanyProfile
): Promise<CompetitorSuggestion[]> {
  const response = await getClient().chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          'You are a market research analyst. Given a company profile, identify 5-10 direct competitors in the same space. Return JSON with a "results" array. Each item: name (string), domain (string, real domain like example.com), similarityScore (integer 0-100), whySimilar (one sentence). Only include real companies with real domains.',
      },
      {
        role: "user",
        content: `Company: ${company.name}
Industry: ${company.industry}
Description: ${company.description}
Target Customer: Age ${company.targetCustomer.ageRange}, ${company.targetCustomer.geography}
Why Customers Buy: ${company.whyCustomersBuy}`,
      },
    ],
  });

  const raw = response.choices[0].message.content ?? '{"results":[]}';
  const parsed = JSON.parse(raw) as { results: CompetitorSuggestion[] };
  return parsed.results ?? [];
}

export async function scoreArticles(
  company: UserCompany,
  competitorName: string,
  competitorDomain: string,
  articles: Array<{
    index: number;
    title: string;
    description: string;
    url: string;
    publishedAt: string;
  }>
): Promise<ArticleScoreResult[]> {
  const context = buildCompanyContext(company, competitorName, competitorDomain);

  const response = await getClient().chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are scoring news articles for competitive relevance. Context:\n${context}

Score each article using these criteria:
- signal_strength 80-100: Product recall, major lawsuit, acquisition, mass layoffs, regulatory action, funding round
- signal_strength 60-79: New product line, major partnership, leadership change, earnings, pricing overhaul
- signal_strength 40-59: Minor product update, new hire, positive press, award
- signal_strength 20-39: Roundup article, brief mention in trend piece
- signal_strength 0-19: Noise — CEO personal life, duplicate story, no substance
- is_noise: true if signal_strength < 20 or article is completely irrelevant
- sentiment_label: Negative for bad news about competitor, Positive for good news, Neutral otherwise
- sentiment_score: -1.0 to +1.0
- summary: 1 sentence, specific to the competitor context
Return JSON with a "results" array matching each input by index.`,
      },
      {
        role: "user",
        content: JSON.stringify(articles),
      },
    ],
  });

  const raw = response.choices[0].message.content ?? '{"results":[]}';
  const parsed = JSON.parse(raw) as { results: ArticleScoreResult[] };
  return parsed.results ?? [];
}

export async function scoreRedditPosts(
  company: UserCompany,
  competitorName: string,
  competitorDomain: string,
  posts: Array<{
    index: number;
    id: string;
    title: string;
    selftext: string;
    score: number;
    subreddit: string;
  }>
): Promise<ArticleScoreResult[]> {
  const context = buildCompanyContext(company, competitorName, competitorDomain);

  const response = await getClient().chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are scoring Reddit posts for competitive intelligence relevance. Context:\n${context}

Score based on: customer sentiment signal, product feedback, brand perception. Negative sentiment (complaints, warnings) is higher priority. is_noise: true for off-topic posts. Return JSON with a "results" array.`,
      },
      {
        role: "user",
        content: JSON.stringify(posts),
      },
    ],
  });

  const raw = response.choices[0].message.content ?? '{"results":[]}';
  const parsed = JSON.parse(raw) as { results: ArticleScoreResult[] };
  return parsed.results ?? [];
}

export async function summarizeJob(
  company: UserCompany,
  competitorName: string,
  competitorDomain: string,
  jobTitle: string,
  jobText: string
): Promise<ArticleScoreResult> {
  const context = buildCompanyContext(company, competitorName, competitorDomain);

  const response = await getClient().chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are a competitive intelligence analyst identifying strategic signals in job postings. Context:\n${context}

Assess what this job posting reveals about the competitor's strategy. Return a single JSON object with exactly these fields:
- signal_strength: integer 0-100 (80-100: new market/product area; 60-79: major capability build; 40-59: team expansion; 20-39: routine hire; 0-19: noise)
- signal_reasoning: string, 1-2 sentences explaining the signal
- sentiment_label: exactly one of "Positive", "Neutral", or "Negative" (Negative = threat to user's company, Positive = competitor growing, Neutral = unclear)
- sentiment_score: float -1.0 to +1.0 matching sentiment_label
- summary: string, 1-2 sentences on the strategic implication
- is_noise: boolean, true if signal_strength < 20`,
      },
      {
        role: "user",
        content: `Job Title: ${jobTitle}\n\n${jobText.slice(0, 2000)}`,
      },
    ],
  });

  const raw = response.choices[0].message.content ?? "{}";
  return JSON.parse(raw) as ArticleScoreResult;
}
