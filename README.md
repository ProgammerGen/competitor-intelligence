# Competitor Intelligence App

Monitor your e-commerce competitors across product launches, news, Reddit, and job postings. Events are scored for relevance and surfaced in a ranked, signal-to-noise–filtered feed.

## Live URL

*(Add Railway URL after deployment)*

---

## Setup (Local)

**Prerequisites:** Node 20+, PostgreSQL running locally or via Docker.

```bash
git clone <repo>
cd competitor-intelligence-app
npm install
cp .env.example .env.local
# Fill in all env vars in .env.local
npm run db:push   # Creates schema in your Postgres instance
node --import tsx/esm server.ts  # Starts app + cron scheduler
```

Then open [http://localhost:3000](http://localhost:3000).

### Environment Variables

| Variable | Source |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `OPENAI_API_KEY` | platform.openai.com |
| `NEWS_API_KEY` | newsapi.org/register |
| `REDDIT_CLIENT_ID` | reddit.com/prefs/apps (script app) |
| `REDDIT_CLIENT_SECRET` | same as above |

---

## Architecture Overview

**Stack:** Next.js 14 (App Router) + Drizzle ORM + PostgreSQL + node-cron + gpt-4o-mini.

Single Railway service runs a custom `server.ts` — a persistent Node.js process that boots Next.js and initializes `node-cron`. This is intentional: Vercel's serverless functions can't run persistent cron jobs.

**Data flow:**
1. User completes setup wizard (domain → AI-enriched profile → confirmed competitors)
2. Daily cron at 06:00 ET (+ manual triggers) runs 4 monitoring modules per competitor
3. Each module inserts events idempotently and scores them via gpt-4o-mini
4. Feed page queries `events JOIN relevance_scores` ordered by `final_score DESC`

### Key Schema Decisions

**`events` table** stores all signals normalized to a common shape:
- `external_id` is the module-specific deduplication key (Shopify product ID, article URL, Reddit post ID, job URL)
- `UNIQUE(competitor_id, module_type, external_id)` is the idempotency index
- `raw_data JSONB` stores the full original payload for score recomputation
- `source_url NOT NULL` — enforced at the DB level, never null

**`relevance_scores`** is separate from `events` to allow recomputation without re-fetching sources.

**`product_snapshots`** stores the full Shopify catalog per sync run. Pruned to 30 days by the products module. Events table holds the permanent delta history.

---

## Data Architecture Q&A

### Q1 — Idempotency

`UNIQUE(competitor_id, module_type, external_id)` on the `events` table, combined with `.onConflictDoNothing()` on every INSERT. If the daily job retries, duplicate INSERTs silently succeed (no row inserted). The `.returning()` check then returns an empty array, so no duplicate `relevance_scores` row is created either. The constraint lives in `src/lib/db/schema.ts` in the `events` table definition.

### Q2 — Snapshot Storage

20 competitors × 500 products × ~1 KB average = ~10 MB per sync run.  
Daily syncs: 10 MB × 365 days = ~3.6 GB/year.

**Strategy:** The products module deletes snapshots older than 30 days after each successful sync (`DELETE WHERE synced_at < now() - 30d`). Only the rolling 30-day window is retained for diffing. The `events` table preserves the permanent record of what launched and when — you don't need the raw snapshot to know a product launched.

For 20 competitors at 30-day retention: ~300 MB, well within Railway's free tier.

### Q3 — Score Recomputation

`events.raw_data` (JSONB) stores the complete original payload from the source API. `relevance_scores` is a separate table with a UNIQUE constraint on `event_id`. To recompute:

1. Query all events with their `raw_data`
2. Re-run the scoring prompt (with updated system prompt) against each batch
3. `INSERT INTO relevance_scores ... ON CONFLICT (event_id) DO UPDATE SET ...`

No source re-fetching needed. The schema was designed for this from day one.

---

## Module Status

| Module | Status | Notes |
|---|---|---|
| A — Product Launches | ✅ Working | Shopify `/products.json` diff, idempotent, batched LLM scoring |
| B — News | ✅ Working | NewsAPI, 20 articles per competitor, single batched LLM call |
| C — Reddit Reviews | ✅ Working | OAuth client credentials, subreddit inference from industry |
| D — Job Postings | ⚠️ Partial | HTML scraping via cheerio; JS-rendered career pages (most modern sites) return empty. See below. |

**Job postings caveat:** The cheerio scraper works on server-rendered career pages. Most modern brands (Shopify-powered stores especially) use React-rendered job boards that return empty HTML to a basic `fetch()`. In production, this would use Playwright/Puppeteer or a dedicated API like Proxycurl. For this build, the module gracefully returns 0 results and logs it — no crash, no user-visible error.

---

## What I Would Build Next (hours 21–30)

1. **Playwright for job scraping** — Replace cheerio with headless browser to handle JS-rendered career pages. Biggest gap in Module D.
2. **Relevance score recomputation endpoint** — `POST /api/events/rescore` to re-score all historical events when the prompt improves.
3. **Email digest** — Daily summary of events above score 60, sent via Resend or Postmark.
4. **Multi-user auth** — Clerk or Auth.js. The schema already has a `users` table and all data traces through `user_company_id`, so the tenant isolation pattern is already in place.
5. **Competitor headcount tracking** — Weekly Proxycurl snapshot of LinkedIn employee count, flagging >5% month-over-month changes.
6. **Score calibration review** — The gpt-4o-mini scoring prompt needs A/B testing. Current version can over-score generic brand mentions if the company name is distinctive.

---

## Relevance Scoring Notes

**Approach:** Three-component weighted formula:

```
final_score = signal_strength × 0.5 + recency_score × 0.3 + sentiment_normalized × 0.2
```

- **Signal strength (50%):** LLM-assigned 0–100 based on the scoring guide in the spec. Uses a company context block injected into every prompt (company name, industry, target customer, why customers buy, competitor name/domain).
- **Recency (30%):** Deterministic decay: 0–7d → 0 penalty, 8–30d → −10, 31–60d → −20, 61–90d → −30, 90+d → suppressed (not stored in feed).
- **Sentiment (20%):** LLM-assigned −1.0 to +1.0, normalized to 0–100. Negative events (e.g. product recalls, layoffs) score higher, which matches the spec's intent: bad news for a competitor is signal-worthy.

**Context feeding:** All scoring prompts include the user's company profile. The LLM can therefore distinguish "competitor launched a product in your exact category" from "competitor launched a product in a tangential category." This is the most important lever for signal quality.

**Batching:** All articles for a single competitor are sent in one prompt call. This reduces cost and enables relative calibration — the model scores articles against each other within the same context window, not in isolation.

**Known failure modes:**
- Small/obscure competitors with little news coverage return mostly noise from NewsAPI. The `is_noise` flag and the 25-point floor catch most of it.
- gpt-4o-mini can conflate two companies with similar names. Mitigated by including the domain in the context block.
- Reddit scraping misses LinkedIn/Twitter-native discussions. Known gap.
- Job page scraping misses JS-rendered sites (see Module D caveat above).

**Deeper context signals I'd add with more time:**
- **User's own hiring signals:** If your company is hiring 5 engineers in a new geography, a competitor's product launch in that geography jumps from moderate to high signal.
- **Geographic footprint overlap:** A competitor expanding into the UK is high signal if that's your primary market; low signal if it's not. Requires the user to specify their primary markets in the Step 1 profile (currently captured in `geography` but not used in scoring context).
- **Category adjacency:** Infer from the product catalog (Module A) which categories the competitor is moving into, weight news about those categories higher.
- **Segment overlap score:** Compare `targetCustomer` profiles between user and competitor. Two brands targeting the same age range and geography in the same industry get higher event weights.

---

## Newsletter Tracking (Architectural Note)

To track competitor newsletters:

**Ingestion:** Create a dedicated email address per competitor (e.g. `brandname@your-intel-domain.com`) using Postmark or Mailgun inbound routing. Sign up for newsletters from a clean inbox so there's no link back to your company.

**Storage:** Each inbound email webhook fires a `POST /api/newsletters/ingest` route. Store the raw HTML and plain text in a `newsletters` table (competitor_id, received_at, subject, html_body, text_body).

**Analysis:** Run gpt-4o-mini on the text body: extract new product mentions, promotional strategy (discount depth, urgency framing), and content themes. Score like other events.

**Legal:** Subscribing to a public newsletter is legal. Processing it for competitive intelligence is standard practice. Do not scrape subscription-gated content or forward newsletters publicly.

**Operational risk:** Newsletters from Klaviyo/Mailchimp embed tracking pixels that can identify the subscriber. Use a privacy proxy or a plain-text email client to avoid revealing yourself to the competitor's ESP.

---

## AI Tool Usage

Built with Claude Code (claude-sonnet-4-6) for scaffolding, architecture decisions, and implementation. Every file was read and understood before being committed. The key decisions I'd defend on the debrief call:

- **Why Drizzle over Prisma:** TypeScript-native, no generated client, better JSONB ergonomics.
- **Why Railway over Vercel:** Persistent process needed for node-cron. Vercel serverless functions have cold starts and time limits that make cron unreliable.
- **Why batched LLM calls:** Cost efficiency + relative score calibration. A single call scoring 20 articles together produces more consistent rankings than 20 isolated calls.
- **Why separate `relevance_scores` table:** Enables recomputation without re-fetching. The events table is append-only; the scores table is overwriteable.
