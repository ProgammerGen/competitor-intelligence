export interface WebSearchResult {
  title: string;
  url: string;
  description: string;
  publishedAt: string; // ISO string
}

async function tavilySearch(query: string, days: number): Promise<WebSearchResult[]> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY ?? "",
      query,
      search_depth: "basic",
      max_results: 20,
      days,
    }),
  });

  if (!res.ok) throw new Error(`Tavily Search error: ${res.status}`);

  const data = (await res.json()) as {
    results?: Array<{
      title: string;
      url: string;
      content?: string;
      published_date?: string;
    }>;
  };

  return (data.results ?? []).map((r) => {
    const d = r.published_date ? new Date(r.published_date) : null;
    return {
      title: r.title,
      url: r.url,
      description: r.content ?? "",
      publishedAt: d && !isNaN(d.getTime()) ? d.toISOString() : new Date().toISOString(),
    };
  });
}

export async function searchWebMentions(competitorName: string): Promise<WebSearchResult[]> {
  return tavilySearch(
    `"${competitorName}" review OR complaint OR announcement OR launch`,
    30
  );
}

export async function searchProductMentions(
  competitorName: string,
  domain: string
): Promise<WebSearchResult[]> {
  return tavilySearch(
    `"${competitorName}" new product OR product launch OR new collection OR new arrival site:${domain} OR "${competitorName}"`,
    365
  );
}
