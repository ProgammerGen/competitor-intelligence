import OpenAI from "openai";
import type { UserCompany, CompanyProduct } from "@/lib/db/schema";

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
  matched_products?: string[];
}

function buildCompanyContext(
  company: UserCompany,
  competitorName: string,
  competitorDomain: string,
  companyProducts?: CompanyProduct[]
): string {
  let ctx = `Company: ${company.name} | Industry: ${company.industry}
Target Customer: Age ${company.targetCustomer.ageRange}, ${company.targetCustomer.geography}, traits: ${company.targetCustomer.traits.join(", ")}
Why Customers Buy: ${company.whyCustomersBuy}
Analyzing competitor: ${competitorName} (${competitorDomain})`;

  if (companyProducts && companyProducts.length > 0) {
    const catalog = companyProducts.slice(0, 20).map((p, i) => {
      const parts = [`${i + 1}. ${p.title}`];
      if (p.price) parts.push(`(${p.price})`);
      if (p.description) parts.push(`— ${p.description.slice(0, 80)}`);
      return parts.join(" ");
    });
    ctx += `\n\n${company.name}'s Product Catalog:\n${catalog.join("\n")}`;
  }

  return ctx;
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

export interface CompetitorScore {
  similarityScore: number;
  whySimilar: string;
}

export async function scoreCompetitor(
  company: CompanyProfile,
  competitorName: string,
  competitorDomain: string
): Promise<CompetitorScore> {
  try {
    const response = await getClient().chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'You are a market research analyst. Given a company profile and a specific competitor, evaluate how similar the competitor is to the company. Return JSON with exactly two keys: similarityScore (integer 0-100, where 100 means identical market/product/audience and 0 means completely unrelated), whySimilar (one sentence explaining the competitive overlap). Base your assessment on industry overlap, target customer similarity, product/service comparison, and geographic overlap. Only use real publicly available knowledge about the competitor.',
        },
        {
          role: "user",
          content: `Company: ${company.name}
Industry: ${company.industry}
Description: ${company.description}
Target Customer: Age ${company.targetCustomer.ageRange}, ${company.targetCustomer.geography}
Why Customers Buy: ${company.whyCustomersBuy}

Competitor to evaluate: ${competitorName} (${competitorDomain})`,
        },
      ],
    });

    const raw = response.choices[0].message.content ?? "{}";
    const parsed = JSON.parse(raw) as CompetitorScore;
    return {
      similarityScore: typeof parsed.similarityScore === "number" ? parsed.similarityScore : 50,
      whySimilar: parsed.whySimilar || "Unable to determine similarity.",
    };
  } catch (err) {
    console.error("[scoreCompetitor] Failed:", err);
    return { similarityScore: 50, whySimilar: "Unable to determine similarity — please verify manually." };
  }
}

export interface ProductComparison {
  headline: string;
  competitorStrengths: string[];
  competitorWeaknesses: string[];
  threatLevel: "High" | "Medium" | "Low";
  recommendation: string;
}

export async function compareProducts(opts: {
  companyName: string;
  companyProduct: { title: string; description?: string | null; price?: string | null; productType?: string | null };
  competitorName: string;
  competitorProduct?: { title: string; description?: string | null; price?: string | null } | null;
  moduleType: string;
  eventSummary: string;
}): Promise<ProductComparison> {
  const isProductLaunch = opts.moduleType === "product_launch" && opts.competitorProduct;

  const systemPrompt = isProductLaunch
    ? `You are a competitive intelligence analyst. Compare a competitor's product against the user's company product. Return JSON with exactly these keys:
- headline: one sentence competitive verdict (e.g. "Direct threat to your mid-range line at a lower price point")
- competitorStrengths: array of 2-3 short bullet strings describing where the competitor product is stronger
- competitorWeaknesses: array of 2-3 short bullet strings describing where the competitor product is weaker or vulnerable
- threatLevel: exactly "High", "Medium", or "Low"
- recommendation: 1-2 sentences on how the company should respond strategically`
    : `You are a competitive intelligence analyst. Analyze how a competitive event impacts a specific product in the user's company portfolio. Return JSON with exactly these keys:
- headline: one sentence summarizing the impact on this specific product
- competitorStrengths: array of 2-3 short bullet strings describing competitive advantages revealed by this event
- competitorWeaknesses: array of 2-3 short bullet strings describing opportunities or gaps the company can exploit
- threatLevel: exactly "High", "Medium", or "Low" based on how much this event threatens this specific product
- recommendation: 1-2 sentences on how the company should respond strategically`;

  const userContent = isProductLaunch
    ? `Company: ${opts.companyName}
Your Product: ${opts.companyProduct.title}${opts.companyProduct.price ? ` (${opts.companyProduct.price})` : ""}
${opts.companyProduct.description ? `Description: ${opts.companyProduct.description}` : ""}
${opts.companyProduct.productType ? `Category: ${opts.companyProduct.productType}` : ""}

Competitor: ${opts.competitorName}
Competitor Product: ${opts.competitorProduct!.title}${opts.competitorProduct!.price ? ` (${opts.competitorProduct!.price})` : ""}
${opts.competitorProduct!.description ? `Description: ${opts.competitorProduct!.description.slice(0, 500)}` : ""}

Existing AI analysis: ${opts.eventSummary}`
    : `Company: ${opts.companyName}
Your Product: ${opts.companyProduct.title}${opts.companyProduct.price ? ` (${opts.companyProduct.price})` : ""}
${opts.companyProduct.description ? `Description: ${opts.companyProduct.description}` : ""}
${opts.companyProduct.productType ? `Category: ${opts.companyProduct.productType}` : ""}

Competitor: ${opts.competitorName}
Event type: ${opts.moduleType}
Event summary: ${opts.eventSummary}`;

  try {
    const response = await getClient().chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    });

    const raw = response.choices[0].message.content ?? "{}";
    const parsed = JSON.parse(raw);
    return {
      headline: parsed.headline || "Unable to generate comparison.",
      competitorStrengths: Array.isArray(parsed.competitorStrengths) ? parsed.competitorStrengths : [],
      competitorWeaknesses: Array.isArray(parsed.competitorWeaknesses) ? parsed.competitorWeaknesses : [],
      threatLevel: ["High", "Medium", "Low"].includes(parsed.threatLevel) ? parsed.threatLevel : "Medium",
      recommendation: parsed.recommendation || "",
    };
  } catch (err) {
    console.error("[compareProducts] Failed:", err);
    return {
      headline: "Unable to generate comparison — please try again.",
      competitorStrengths: [],
      competitorWeaknesses: [],
      threatLevel: "Medium",
      recommendation: "",
    };
  }
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
  }>,
  companyProducts?: CompanyProduct[]
): Promise<ArticleScoreResult[]> {
  const context = buildCompanyContext(company, competitorName, competitorDomain, companyProducts);

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
- summary: 1-2 sentences. MUST reference "${company.name}" by name and explain how this event could specifically affect their business or competitive position.
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

export async function scoreProducts(
  company: UserCompany,
  competitorName: string,
  competitorDomain: string,
  products: Array<{
    index: number;
    title: string;
    description: string;
    price: string;
    variantCount: number;
    url: string;
    launchedAt: string;
  }>,
  companyProducts?: CompanyProduct[]
): Promise<ArticleScoreResult[]> {
  const context = buildCompanyContext(company, competitorName, competitorDomain, companyProducts);

  const hasUserProducts = companyProducts && companyProducts.length > 0;
  const productCatalogNames = hasUserProducts
    ? companyProducts.map((p) => p.title).join(", ")
    : "";

  const matchedProductsInstruction = hasUserProducts
    ? `
For each competitor product, identify which of ${company.name}'s specific products (from the catalog above) are most directly affected or threatened. Return these in a "matched_products" string array using EXACT product names from ${company.name}'s catalog. If no specific product is directly affected, return an empty array [].
Available product names to match against: ${productCatalogNames}

Your summary MUST reference "${company.name}" by name. When matched products exist, explain the impact: "This directly competes with ${company.name}'s [Product Name] because..."`
    : `\nYour summary MUST reference "${company.name}" by name and explain the competitive impact.`;

  const response = await getClient().chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are a competitive intelligence analyst specializing in product launches. Context:\n${context}

You are analyzing product launches from competitor "${competitorName}" (${competitorDomain}).
For EACH product, evaluate:
1. What does this product do? Who is it for?
2. How does it compare to ${company.name}'s offerings? Does it target the same customers?
3. Could this product take market share from ${company.name}?

Score each product using these criteria:
- signal_strength 80-100: Direct competitor product targeting same customer segment, similar price point, potential market share threat
- signal_strength 60-79: Related product in same category, different positioning but overlapping audience
- signal_strength 40-59: Adjacent product, same industry but different niche or customer segment
- signal_strength 20-39: Loosely related product, minimal competitive overlap
- signal_strength 0-19: Unrelated product, different market entirely
- is_noise: ALWAYS false — every product launch is relevant competitive intelligence
- sentiment_label: "Negative" if threatening to ${company.name}, "Positive" if it represents an opportunity (e.g., competitor moving away from your space), "Neutral" if unclear
- sentiment_score: -1.0 to +1.0
- signal_reasoning: 1-2 sentences explaining the competitive implication
- summary: 1-2 sentences describing what this product is, who it's for, and how it relates to ${company.name}'s business. Be specific — mention product features, target audience, and competitive positioning.
${matchedProductsInstruction}

Return JSON with a "results" array matching each input by index.`,
      },
      {
        role: "user",
        content: JSON.stringify(products),
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
  jobText: string,
  companyProducts?: CompanyProduct[]
): Promise<ArticleScoreResult> {
  const context = buildCompanyContext(company, competitorName, competitorDomain, companyProducts);

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
- sentiment_label: exactly one of "Positive", "Neutral", or "Negative" (Negative = threat to ${company.name}, Positive = competitor growing, Neutral = unclear)
- sentiment_score: float -1.0 to +1.0 matching sentiment_label
- summary: string, 1-2 sentences explaining what this hiring signal means for ${company.name} specifically. MUST reference "${company.name}" by name.
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
