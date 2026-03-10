export interface NewsArticle {
  url: string;
  title: string;
  description: string;
  publishedAt: string;
  source: { name: string };
}

export async function fetchCompetitorNews(
  competitorName: string
): Promise<NewsArticle[]> {
  const query = encodeURIComponent(`"${competitorName}"`);
  const url = `https://newsapi.org/v2/everything?q=${query}&pageSize=20&sortBy=publishedAt&language=en&apiKey=${process.env.NEWS_API_KEY}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`NewsAPI error: ${res.status}`);
  }

  const data = (await res.json()) as {
    articles: Array<{
      url: string;
      title: string;
      description: string | null;
      publishedAt: string;
      source: { name: string };
    }>;
  };

  return data.articles
    .filter((a) => a.title !== "[Removed]" && a.url !== "https://removed.com")
    .map((a) => ({ ...a, description: a.description ?? "" }));
}
