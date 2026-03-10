import * as cheerio from "cheerio";
import type { ShopifyProduct } from "@/lib/db/schema";

const TIMEOUT = 10000;
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

function slugToHandle(url: string): string {
  return url.split("/").pop()?.split("?")[0] ?? url;
}

function hashId(str: string): number {
  let h = 0;
  for (const c of str) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

function normalise(title: string): string {
  return decodeURIComponent(title).replace(/[-_+]/g, " ").replace(/\s+/g, " ").trim();
}

function makeProduct(url: string, title?: string, price?: string, image?: string, createdAt?: string): ShopifyProduct {
  return {
    id: hashId(url),
    title: title ? normalise(title) : normalise(slugToHandle(url)),
    handle: slugToHandle(url),
    created_at: createdAt ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
    variants: [{ price: price ?? "0", title: "Default" }],
    images: image ? [{ src: image }] : [],
  };
}

// ---------- Strategy 1: Shopify /products.json ----------
async function tryProductsJson(domain: string): Promise<ShopifyProduct[]> {
  try {
    const res = await fetch(`https://${domain}/products.json?limit=250`, {
      signal: AbortSignal.timeout(TIMEOUT),
      headers: HEADERS,
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { products: ShopifyProduct[] };
    return data.products ?? [];
  } catch {
    return [];
  }
}

// ---------- Strategy 2: WooCommerce public Store API ----------
async function tryWooCommerce(domain: string): Promise<ShopifyProduct[]> {
  try {
    const res = await fetch(
      `https://${domain}/wp-json/wc/store/v1/products?per_page=100`,
      { signal: AbortSignal.timeout(TIMEOUT), headers: HEADERS }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as Array<{
      id: number;
      name: string;
      slug: string;
      permalink: string;
      date_created: string;
      prices?: { price?: string };
      images?: Array<{ src: string }>;
    }>;
    if (!Array.isArray(data)) return [];
    return data.map((p) => ({
      id: p.id,
      title: p.name,
      handle: p.slug,
      created_at: p.date_created,
      updated_at: p.date_created,
      variants: [{ price: p.prices?.price ?? "0", title: "Default" }],
      images: p.images ?? [],
    }));
  } catch {
    return [];
  }
}

// ---------- Strategy 3: Sitemap XML ----------
async function discoverSitemapUrls(domain: string): Promise<string[]> {
  // Check robots.txt for sitemap directives first
  const candidates = new Set<string>();
  try {
    const robotsRes = await fetch(`https://${domain}/robots.txt`, {
      signal: AbortSignal.timeout(TIMEOUT),
      headers: HEADERS,
    });
    if (robotsRes.ok) {
      const text = await robotsRes.text();
      for (const line of text.split("\n")) {
        const m = line.match(/^Sitemap:\s*(.+)/i);
        if (m) candidates.add(m[1].trim());
      }
    }
  } catch { /* ignore */ }

  candidates.add(`https://${domain}/sitemap.xml`);
  candidates.add(`https://${domain}/sitemap_index.xml`);

  return [...candidates];
}

async function trySitemap(domain: string): Promise<ShopifyProduct[]> {
  const sitemapUrls = await discoverSitemapUrls(domain);
  const productUrls: string[] = [];

  for (const sitemapUrl of sitemapUrls) {
    try {
      const res = await fetch(sitemapUrl, {
        signal: AbortSignal.timeout(TIMEOUT),
        headers: HEADERS,
      });
      if (!res.ok) continue;

      const xml = await res.text();
      const $ = cheerio.load(xml, { xmlMode: true });

      // Follow product sub-sitemaps
      const subSitemaps: string[] = [];
      $("sitemap loc").each((_, el) => {
        const loc = $(el).text().trim();
        if (/product/i.test(loc)) { subSitemaps.push(loc); }
      });

      for (const sub of subSitemaps) {
        try {
          const subRes = await fetch(sub, { signal: AbortSignal.timeout(TIMEOUT), headers: HEADERS });
          if (!subRes.ok) continue;
          const subXml = await subRes.text();
          const $sub = cheerio.load(subXml, { xmlMode: true });
          $sub("url loc").each((_, el) => { productUrls.push($sub(el).text().trim()); });
        } catch { /* skip */ }
      }

      // Also look for product URLs in the root sitemap
      $("url loc").each((_, el) => {
        const loc = $(el).text().trim();
        if (/\/(products?|items?|shop|catalog|p)\/[^/]+/.test(loc)) {
          productUrls.push(loc);
        }
      });

      if (productUrls.length > 0) break;
    } catch { continue; }
  }

  if (productUrls.length === 0) return [];

  return productUrls
    .filter((u, i, arr) => arr.indexOf(u) === i)
    .slice(0, 250)
    .map((url) => makeProduct(url));
}

// ---------- Strategy 4: HTML scraping ----------
const PRODUCT_URL_RE = /\/(products?|items?|p|pd|goods|buy)\/[^/?#"']{3,}/;
const PRODUCT_LISTING_PATHS = [
  "/products",
  "/shop",
  "/collections/all",
  "/catalog",
  "/store",
  "/new-arrivals",
  "/all-products",
  "/shop/all",
];

async function tryHtmlScrape(domain: string): Promise<ShopifyProduct[]> {
  for (const path of PRODUCT_LISTING_PATHS) {
    try {
      const res = await fetch(`https://${domain}${path}`, {
        signal: AbortSignal.timeout(TIMEOUT),
        headers: HEADERS,
      });
      if (!res.ok) continue;

      const html = await res.text();
      const $ = cheerio.load(html);
      const products: ShopifyProduct[] = [];
      const seen = new Set<number>();

      // JSON-LD
      $('script[type="application/ld+json"]').each((_, el) => {
        try {
          const data = JSON.parse($(el).html() ?? "{}") as Record<string, unknown>;
          const entries =
            data["@type"] === "ItemList"
              ? ((data.itemListElement as Record<string, unknown>[]) ?? []).map(
                  (e) => (e.item ?? e) as Record<string, unknown>
                )
              : data["@type"] === "Product"
              ? [data]
              : [];

          for (const p of entries) {
            if (typeof p.name !== "string") continue;
            const url = typeof p.url === "string" ? p.url : `https://${domain}${path}`;
            const offers = p.offers as Record<string, unknown> | undefined;
            const id = hashId(url);
            if (seen.has(id)) continue;
            seen.add(id);
            products.push(makeProduct(
              url,
              p.name,
              String(offers?.price ?? offers?.lowPrice ?? "0"),
              typeof p.image === "string" ? p.image : undefined
            ));
          }
        } catch { /* skip malformed */ }
      });

      // Schema.org microdata
      $("[itemtype*='schema.org/Product']").each((_, el) => {
        const nameEl = $(el).find("[itemprop='name']").first();
        const priceEl = $(el).find("[itemprop='price']").first();
        const linkEl = $(el).find("a[href]").first();
        const name = nameEl.text().trim() || nameEl.attr("content");
        const href = linkEl.attr("href");
        if (!name || !href) return;
        const url = href.startsWith("http") ? href : `https://${domain}${href}`;
        const id = hashId(url);
        if (seen.has(id)) return;
        seen.add(id);
        products.push(makeProduct(url, name, (priceEl.attr("content") ?? priceEl.text().trim()) || "0"));
      });

      // Product links by URL pattern (fallback)
      if (products.length < 5) {
        $("a[href]").each((_, el) => {
          const href = $(el).attr("href") ?? "";
          if (!PRODUCT_URL_RE.test(href)) return;
          const url = href.startsWith("http") ? href : `https://${domain}${href}`;
          const id = hashId(url);
          if (seen.has(id)) return;
          seen.add(id);
          const title = $(el).find("img").attr("alt") || $(el).text().trim();
          if (title.length < 3 || title.length > 200) return;
          products.push(makeProduct(url, title));
        });
      }

      if (products.length > 0) return products.slice(0, 250);
    } catch { continue; }
  }

  return [];
}

// ---------- Public export ----------
export async function fetchShopifyProducts(domain: string): Promise<ShopifyProduct[]> {
  const shopify = await tryProductsJson(domain);
  if (shopify.length > 0) return shopify;

  const woo = await tryWooCommerce(domain);
  if (woo.length > 0) return woo;

  const sitemap = await trySitemap(domain);
  if (sitemap.length > 0) return sitemap;

  return tryHtmlScrape(domain);
}
