# Competitor Intelligence App

Monitor your e-commerce competitors across product launches, news, web mentions, and job postings. Events are scored for relevance and surfaced in a ranked, signal-to-noise–filtered feed.

**Live URL:** [competitor-intelligence-zeta.vercel.app](https://competitor-intelligence-zeta.vercel.app/)

---

## Setup (local dev)

**Prerequisites:** Node 22+, PostgreSQL (local or Railway).

```bash
git clone <repo>
cd competitor-intelligence-app
npm install
cp .env.example .env.local
# Fill in DATABASE_URL, OPENAI_API_KEY, NEWS_API_KEY, TAVILY_API_KEY
npm run db:push   # push schema to Postgres
npm run dev       # starts at http://localhost:3000
```

### Environment variables

| Variable | Source |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Railway → Variables tab) |
| `OPENAI_API_KEY` | platform.openai.com |
| `NEWS_API_KEY` | newsapi.org/register |
| `TAVILY_API_KEY` | tavily.com — free tier: 1000 searches/month (used by Module C and Module A fallback) |
| `CRON_SECRET` | Auto-injected by Vercel — leave blank locally |

---

## Architecture Overview

**Stack:** Next.js 16 (App Router) · TypeScript · React 19 · Drizzle ORM · PostgreSQL · gpt-4o-mini · Tailwind CSS v3 · Vercel + Railway

**Deployment:**

```
Vercel (Next.js serverless)          Railway
├── All pages + API routes    ←DB→   └── PostgreSQL addon
└── /api/cron/daily  ← triggered by Vercel Cron at 10:00 UTC daily
```

`server.ts` and `node-cron` remain in the repo for local reference but are not used in production. Vercel Cron calls `GET /api/cron/daily` on schedule. Manual module runs from the monitoring page use `after()` (Next.js 16) to fire-and-forget without blocking the HTTP response.

**Data flow:**

1. User completes setup wizard: domain → AI-enriched profile → confirmed competitor list
2. Vercel Cron (daily) or manual "Run Now" triggers 4 monitoring modules per competitor
3. Each module inserts events idempotently and scores them via gpt-4o-mini
4. Feed queries `events JOIN relevance_scores` ordered by `final_score DESC`

### Key schema decisions

`events` table — all intelligence signals normalized to a common shape:

- `external_id`: module-specific deduplication key (Shopify product ID · article URL · web result URL · job URL)
- `UNIQUE(competitor_id, module_type, external_id)`: the idempotency index — schema-level, not application-level
- `raw_data JSONB`: full original payload stored for score recomputation without re-fetching
- `source_url NOT NULL`: enforced at DB level, never null

`relevance_scores` is separate from `events` to allow recomputation independently of event data. Includes `matched_products JSONB` for storing which of the user's products are affected by a competitor event.

`company_products` stores the user's own product catalog (auto-fetched from their Shopify store + manually added). Used by all AI scoring prompts to identify direct competitive threats.

`product_snapshots` stores full competitor catalogs per sync. Pruned to 30 days. The `events` table holds the permanent delta history.

---

## Data Architecture Q&A

### Q1 — Idempotency: how does the schema prevent duplicate events if the daily job runs twice?

`UNIQUE(competitor_id, module_type, external_id)` on the `events` table, combined with `.onConflictDoNothing()` on every INSERT. If the daily job retries, duplicate INSERTs silently succeed without inserting a row. The `.returning()` check then returns an empty array, so no duplicate `relevance_scores` row is created either.

The constraint lives in `src/lib/db/schema.ts`. The enforcement is at the schema level — application code cannot accidentally bypass it.

### Q2 — Snapshot storage: 20 competitors × 500 products — how much per year and what's the strategy?

**Estimate:** 20 competitors × 500 products × ~1 KB = 10 MB per sync. Daily: 10 MB × 365 = **~3.6 GB/year** without pruning.

**Strategy:** The products module deletes snapshots with `synced_at < now() - 30 days` after each successful sync. This caps live snapshot storage at ~300 MB (30-day rolling window) regardless of runtime. The `events` table retains the permanent record of what launched and when — no raw snapshot is needed to answer "what products launched this quarter."

### Q3 — Score recomputation: how do you re-score historical events without re-fetching source data?

`events.raw_data` (JSONB) stores the complete original payload from each source. `relevance_scores` is a separate table with a UNIQUE constraint on `event_id`. To recompute with an improved prompt:

```typescript
const allEvents = await db.select().from(events);
for (const event of allEvents) {
  const score = await rescoreWithNewPrompt(event.raw_data, companyContext);
  await db.insert(relevanceScores)
    .values({ eventId: event.id, ...score })
    .onConflictDoUpdate({ target: relevanceScores.eventId, set: score });
}
```

No HTTP requests to original sources. Scoring is a pure function over stored data — the schema was designed for this from the start.

---

## Module Status

| Module | Status | Notes |
|---|---|---|
| A — Product Launches | ⚠️ Partial | 4-strategy fetch (Shopify → WooCommerce → Sitemap → HTML scrape) + Tavily fallback; WAF-blocked sites return web mentions instead of structured product data |
| B — News | ✅ Working | NewsAPI `/v2/everything`, 20 articles/competitor, single batched LLM call, suppresses score < 25 |
| C — Web Search | ✅ Working | Tavily Search API, past-30-day web mentions, batched LLM scoring, suppresses score < 25 |
| D — Job Postings | ⚠️ Partial | Cheerio HTML scraper; JS-rendered career pages (most major brands) return empty — Puppeteer/Playwright needed |

**Job postings caveat:** The cheerio scraper works on server-rendered career pages. Most modern brands use React/Next.js job boards that return empty HTML to a plain `fetch()`. In production this would use Playwright or Proxycurl. The module fails gracefully — 0 results logged, no crash, no user-visible error.

**Product launches caveat:** Sites with WAF/bot protection (403/429 responses on all 4 strategies) cannot be scraped. Major retailers commonly block automated requests.

---

## Requirements Gap Analysis

### Fully implemented ✅

- Step 1: all 5 company profile fields, AI enrichment from homepage scrape, editable form, confirm CTA
- Step 2: competitor list with name/domain/score/why_similar, remove, add custom, confirm and trigger modules
- Step 3: all 4 required modules running and storing events with source URL, timestamps, relevance score, module type
- Step 4: feed with all required card fields, competitor/module/score filters, sort by relevance and date, empty + error states
- Relevance scoring: signal 50% + recency 30% + sentiment 20%, decay table exact to spec, suppress 90+ days
- Context feeding: company name, industry, target customer profile, why_customers_buy fed to every scoring prompt
- Batching: news and web search results scored in a single LLM call per competitor (spec requirement)
- Idempotency: `UNIQUE(competitor_id, module_type, external_id)` enforced at schema level
- All 8 tables: users, user_companies, company_products, tracked_competitors, product_snapshots, events, relevance_scores, module_runs
- Deployment: Vercel (app) + Railway (PostgreSQL) + Vercel Cron (daily scheduler)
- Monitoring page: module status grid, last-run timestamps, Run Now triggers per module, error states
- Competitor management: add/remove competitors from monitoring page, change company resets all data
- Company product catalog: auto-fetched on company confirmation, manual add/delete, daily sync, fed into all AI scoring prompts
- Product matching: AI identifies which user products are affected by competitor events, shown as "Affects: Your [Product]" pills in feed
- Company-aware summaries: all module summaries reference user's company name and explain specific business impact

### Gaps / partial ⚠️

| Gap | Spec requirement | Status | Fix |
|---|---|---|---|
| Similarity score not inline-editable | "Similarity score: 0–100 (editable)" | Displayed as badge only | Add `<input type="number">` per competitor row |
| Job fields: no department or location | Store title, department, location, URL, summary | Only title + URL + summary stored | Parse from HTML; not reliably available on static pages |
| Detected timestamp not in feed | Both event timestamp and detected timestamp required | Only `event_occurred_at` shown | Add second timestamp to FeedCard |
| Sort by sentiment | "Sort by: relevance (default), date, sentiment" | Score and date only | `orderBy(desc(relevanceScores.sentimentScore))` |
| Web Search: Reddit replaced with Tavily | Reddit returned 403 in production | Tavily Search API, past-30-day results, no OAuth required | — |

### Out of scope (extra credit — not built)

- Headcount tracking (Proxycurl/LinkedIn)
- Leadership change detection
- Newsletter tracking — architectural writeup below

---

## What I Would Build Next (hours 21–30)

1. **Playwright for job scraping** — replace cheerio with a headless browser. Biggest gap in Module D.
2. **Fix similarity score editing** — number input per competitor row in Step 2.
3. **Show detected_at in feed cards** — add second timestamp line alongside event timestamp.
4. **Sort by sentiment** — third sort option in feed filter bar.
5. **Relevance score recomputation endpoint** — `POST /api/events/rescore` to re-score all historical events when the prompt improves; using `raw_data` already stored.
6. **Deeper context signals in scoring** — geographic footprint, category adjacency, customer segment overlap fed into the LLM prompt (see Relevance Scoring section).
7. **Email digest** — daily summary of events above score 60, sent via Resend or Postmark.
8. **Cursor-based pagination** — replace offset pagination in the feed with keyset pagination on `(final_score, id)` for consistent performance at scale.
9. **NewsAPI domain filtering** — `domains=` param to reduce off-topic results for brands that appear in unrelated articles.

---

## Relevance Scoring

### Formula

```
recency_component  = 100 + recency_penalty             // range: 70–100
sentiment_norm     = (sentiment_score + 1) / 2 * 100   // –1.0..+1.0 → 0..100

final_score = round(
  signal_strength   × 0.50 +
  recency_component × 0.30 +
  sentiment_norm    × 0.20
)
```

### Recency decay

| Age | Penalty | Recency component | Notes |
| --- | --- | --- | --- |
| 0–7 days | 0 | 100 | |
| 8–30 days | −10 | 90 | |
| 31–60 days | −20 | 80 | |
| 61–90 days | −30 | 70 | |
| 91–365 days | −30 (capped) | 70 | Product launches only — shown in feed at reduced rank |
| 90+ days | Suppressed | Not shown | News, web search, job postings |
| 365+ days | Excluded | Not fetched | Products filtered out before insert |

### Context feeding

Every scoring prompt includes a `buildCompanyContext()` block:

- User company: name, industry, description
- Target customer: age range, geography, personality traits
- Why customers buy (value proposition)
- Competitor: name and domain
- **User's product catalog** (up to 20 products with title, price, description) — enables the AI to identify which specific user products are threatened by competitor activity

This ensures the model scores articles relative to what matters to *this specific brand*. A funding round for a direct competitor in the same category scores significantly higher than the same event for a tangential player. Product matching allows summaries like "this directly competes with your Anti-Aging Serum" rather than generic descriptions.

### Batching

All articles for a single competitor are sent in one LLM call. The model returns a `{ "results": [...] }` array matching the input by index. Benefits: fewer API calls (lower cost) + relative calibration (model compares articles against each other within one context window, producing more consistent rankings).

### Known failure modes

- **LLM type coercion:** gpt-4o-mini occasionally returns `signal_strength` as a string (`"neutral"`) when the prompt uses ambiguous language. Fixed with: (1) explicit type specification in prompts, (2) defensive `typeof` coercion before every DB insert.
- **Company name ambiguity:** gpt-4o-mini can conflate two brands with similar names. Mitigated by including the competitor domain in the context block.
- **Small competitor coverage:** Obscure brands with minimal news coverage return mostly noise from NewsAPI. The `is_noise` flag and 25-point floor catch most of it, but expect low event volume for less-known competitors.
- **Batch calibration drift:** In a 20-article batch spanning noise to critical events, mid-range articles can be miscalibrated relative to each other. A two-pass approach (filter noise first, calibrate signal second) would improve this.

### Deeper context signals (not yet implemented)

The spec explicitly calls these out as extra credit. Here is how I would implement each:

- **Customer segment overlap:** Parse competitor's product descriptions and infer target demographics. If a competitor launches for the same age/geography segment as the user, boost `signal_strength` context by +15 in the prompt.
- **Geographic footprint:** The user's `geography` field is already stored. Feed it into scoring: *"The user operates primarily in {geography}. A competitor expanding into that market should be scored Critical; expansion elsewhere is Moderate."*
- **Category adjacency:** Infer categories from Step 1 profile and the product catalog (Module A). Weight news about direct-category moves higher than adjacent-category moves.
- **Own hiring signals:** Run Module D on the user's own careers page. If the user is hiring in a new geography or product area, competitor news in that same area becomes high signal. This is one loop deeper than any competitor-only monitoring and is the kind of signal that separates intelligence platforms from news aggregators.

---

## Newsletter Tracking (architectural writeup — no code)

### Ingestion

Create a dedicated email address per competitor (`intel+allbirds@yourdomain.com`). Use a transactional email provider with inbound parsing (SendGrid Inbound Parse, Postmark Inbound) to receive emails as HTTP POST webhooks. Each webhook fires `POST /api/webhooks/newsletter`.

### Storage

```sql
newsletters (
  id           uuid PRIMARY KEY,
  competitor_id uuid REFERENCES tracked_competitors(id),
  received_at  timestamp,
  subject      text,
  body_html    text,
  body_text    text,
  from_email   text
)
```

### Analysis

On receipt, run gpt-4o-mini against `body_text` with the same `buildCompanyContext()` block. Extract: product announcements, promotional signals, pricing changes, tone shifts. Score using the same relevance framework. Store as an `event` with `module_type = 'newsletter'` and `external_id = hash(subject + received_at)` for idempotency.

### Legal and operational considerations

- Subscribing to publicly available newsletters with your own email is legal in most jurisdictions.
- CAN-SPAM (US) and GDPR (EU) require honoring unsubscribe requests. Treat monitoring addresses as real subscriptions.
- Do not republish newsletter content externally. Internal intelligence use only.
- Klaviyo/Mailchimp embed tracking pixels that reveal the subscriber's email to the competitor's ESP. Use a privacy-aware email proxy or strip tracking pixels before storage.
- Cost at scale: 20 competitors × 1 email/day × ~$0.0005/LLM call ≈ $0.01/day.

---

## AI Tool Usage

Claude Code (Anthropic) was used throughout — scaffolding, debugging, refactoring, and reviewing decisions.

**How output was validated:**

- Every generated file was read and understood before accepting
- Architectural decisions (schema idempotency, snapshot pruning, scoring formula, 4-strategy product fetching waterfall) were independently reasoned through before implementation
- Bugs introduced by AI output were caught and fixed through TypeScript compiler errors and local testing:
  - `signal_strength` returning as string `"neutral"` from the LLM → fixed with explicit prompt type specification and `typeof` guards
  - Cheerio `.each()` callback returning `number` from `push()` → fixed with explicit curly braces
  - `??` and `||` operator precedence error in price normalization → fixed with parentheses
- The scoring formula, context feeding approach, and deduplication strategy are defensible from first principles

**What I would explain on the debrief call:**

- **Why Drizzle over Prisma:** TypeScript-native, no generated client, better JSONB ergonomics, lighter runtime overhead.
- **Why Vercel Cron over node-cron on Railway:** Vercel Cron is managed, zero infrastructure, survives deployments automatically. node-cron required a persistent process — a stateful dependency that complicates zero-downtime deploys.
- **Why batched LLM calls:** Cost efficiency + relative score calibration within one context window.
- **Why separate `relevance_scores` table:** Decouples event storage (append-only) from scoring (overwriteable). Enables prompt iteration without data loss.
- **Why Tavily over Reddit:** Reddit's public JSON API returns 403 on Vercel serverless. Tavily provides structured web search results with no auth friction, a free tier adequate for this workload, and broader coverage across review sites, forums, and blogs.

---

## Release Notes

### v1.2.0

**Company Product Intelligence & Enhanced AI Scoring**

- **Company product catalog** — When you confirm your company profile, the app auto-fetches your product catalog (Shopify stores). Products are stored in a new `company_products` table and synced daily. Non-Shopify stores can add products manually via the new `/company/products` management page.
- **AI product matching** — All scoring prompts (product launches, news, web search, job postings) now receive your product catalog as context. The AI identifies which of your products are directly affected by competitor activity and returns `matched_products` — stored in `relevance_scores` for display.
- **"Affects your product" pills in feed** — When a competitor event matches one of your products, the feed shows red-tinted pills (e.g. "Affects: Your Anti-Aging Serum") so you can instantly see which products are threatened.
- **Company-aware summaries** — All AI-generated summaries now reference your company by name and explain specific business impact, replacing generic descriptions.
- **Product batching fix** — gpt-4o-mini drops the `index` field on large inputs (60+ products). Products are now scored in batches of 20 with fallback index matching. Previously only competitors with < 60 products appeared in the feed.
- **Products management page** — New page at `/company/products` for viewing auto-detected products, manually adding products, and triggering re-syncs.
- **Sidebar nav update** — Added "Your Products" navigation item linking to the product catalog page.
- **Daily product sync** — Scheduler refreshes user's company products before running competitor modules each day.

**New files:**

- `src/lib/services/companyProducts.ts` — sync + query company product catalog
- `src/app/api/company/products/route.ts` — CRUD API for company products
- `src/app/company/products/page.tsx` — product catalog management UI
- `src/components/Sidebar.tsx` — extracted sidebar component with new nav items

**Schema changes:**

- New `company_products` table (8 columns + unique index on `user_company_id, external_id`)
- New `matched_products` JSONB column on `relevance_scores`

**Known limitations in v1.2.0:**

- Company product auto-fetch only works for Shopify stores; other platforms require manual product entry
- Product matching accuracy depends on how well gpt-4o-mini understands the competitive relationship between products
- Job module still returns empty on JS-rendered career pages (unchanged from v1.1.0)

---

### v1.1.0

**Changes:**

- **Module C: Reddit → Tavily Web Search** — Reddit's public JSON API returned 403 on Vercel serverless. Replaced with Tavily Search API (`past 30 days`, `max_results: 20`). Broader coverage across review sites, forums, and blogs. Requires `TAVILY_API_KEY`.
- **Module A: Expanded product window** — Products module now surfaces all products with `created_at` within the past year, not only items new since the last snapshot. Recency penalty capped at −30 for products 91–365 days old so they remain visible in the feed.
- **Module A: Tavily fallback** — When all 4 scraping strategies (Shopify JSON → WooCommerce → Sitemap → HTML) return no results (e.g. WAF-blocked sites), the module falls back to a Tavily product-launch search and inserts results as `product_launch` events.
- **Min-score filter fix** — Feed filter always sends `minScore` param; adds `force-dynamic` to events route to prevent stale Next.js cache serving wrong results.
- **ESLint 9** — Bumped `eslint` to `^9` to match `eslint-config-next@16` peer requirement (resolves Vercel build failure).

**Known limitations in v1.1.0:**

- **Module A (Product Launches) — partial ⚠️** — Shopify `/products.json` works reliably; WooCommerce, Sitemap, and HTML scraping strategies work on server-rendered sites. Major retailers with WAF/bot protection (403/429 on all 4 strategies) fall back to Tavily web search, which returns article-style mentions rather than structured product data. Full product catalog coverage requires a paid scraping proxy (e.g. Oxylabs, Bright Data) or retailer API access.
- Job module returns empty results on JS-rendered career pages
- Similarity score is display-only in the competitor list (not inline-editable)
- Feed shows event timestamp only; detected_at not displayed
- Sort by sentiment not available

---

### v1.0.0

**Features shipped:**

- Company profile setup — AI enrichment from homepage scrape, fully editable before confirmation
- Competitor discovery — LLM returns 5–10 competitors with similarity scores and reasoning
- Module A (Product Launches) — 4-strategy product fetch (Shopify → WooCommerce → Sitemap → HTML scrape), snapshot diffing, idempotent inserts
- Module B (News) — NewsAPI, 20 articles per competitor, single batched LLM scoring call, 25-point noise floor
- Module C (Reddit) — public JSON API, industry-inferred subreddits, score ≥ 5 filter, sentiment scoring
- Module D (Job Postings) — cheerio scraper, strategic signal summarization, graceful failure on JS-rendered pages
- Relevance scoring — signal (50%) + recency decay (30%) + sentiment (20%), 90-day suppress, context-aware LLM prompts
- Intelligence feed — unified ranked view, filter by competitor/module/score, sort by relevance or date, infinite scroll
- Module status dashboard — per-competitor per-module status grid, last-run timestamps, Run Now buttons, error states
- Competitor management — add/remove competitors, change company (full data reset)

**Architecture:**

- Next.js 16 (App Router) + Drizzle ORM + PostgreSQL
- 7-table schema with idempotency constraints and JSONB raw data storage
- Deployed to Vercel (app) + Railway (PostgreSQL); Vercel Cron replaces node-cron
- `after()` used for fire-and-forget module execution on Vercel serverless

**Known limitations in v1.0.0:**

- Job module returns empty results on JS-rendered career pages
- Product detection blocked by WAF/bot protection on major retailer sites
- Similarity score is display-only in the competitor list (not inline-editable)
- Feed shows event timestamp only; detected_at not displayed
- Sort by sentiment not available
