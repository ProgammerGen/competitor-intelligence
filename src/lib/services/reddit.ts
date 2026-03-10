const INDUSTRY_SUBREDDITS: Record<string, string[]> = {
  Beauty: ["beauty", "SkincareAddiction", "MakeupAddiction", "femalefashionadvice"],
  Apparel: ["malefashionadvice", "femalefashionadvice", "streetwear", "frugalmalefashion"],
  "Health & Wellness": ["Supplements", "fitness", "nutrition", "loseit"],
  "Home & Living": ["malelivingspace", "femininelivingspace", "HomeImprovement"],
  "Food & Beverage": ["food", "AskCulinary", "Coffee", "tea"],
  Technology: ["technology", "gadgets", "tech", "hardware"],
  "Sports & Outdoors": ["running", "cycling", "hiking", "Fitness"],
  "E-commerce": ["ecommerce", "Entrepreneur", "smallbusiness", "shopify"],
};

const DEFAULT_SUBREDDITS = ["entrepreneur", "smallbusiness", "ecommerce"];

export interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  score: number;
  subreddit: string;
  url: string;
  created_utc: number;
  permalink: string;
}

export async function searchRedditPosts(
  competitorName: string,
  industry: string
): Promise<RedditPost[]> {
  const subreddits = INDUSTRY_SUBREDDITS[industry] ?? DEFAULT_SUBREDDITS;
  const srParam = subreddits.join("+");
  const query = encodeURIComponent(`"${competitorName}"`);

  const res = await fetch(
    `https://www.reddit.com/r/${srParam}/search.json?q=${query}&sort=new&limit=25&t=month&restrict_sr=1`,
    {
      headers: {
        "User-Agent": "CompetitorIntel/1.0 (competitor intelligence tool)",
      },
    }
  );

  if (!res.ok) throw new Error(`Reddit search error: ${res.status}`);

  const data = (await res.json()) as {
    data: {
      children: Array<{
        data: {
          id: string;
          title: string;
          selftext: string;
          score: number;
          subreddit: string;
          url: string;
          created_utc: number;
          permalink: string;
        };
      }>;
    };
  };

  return data.data.children
    .map((c) => c.data)
    .filter((p) => p.score >= 5);
}
