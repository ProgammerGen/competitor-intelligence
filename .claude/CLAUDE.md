# Competitor Intelligence App — Project Notes

## Stack

- **Framework:** Next.js 16 (App Router), TypeScript, React 19
- **ORM:** Drizzle ORM with pg driver
- **DB:** PostgreSQL (Railway addon in prod, local Postgres in dev)
- **LLM:** OpenAI gpt-4o-mini (lazy-initialized client via `getClient()` in `src/lib/services/openai.ts`)
- **Scheduler:** Vercel Cron (`vercel.json` → `GET /api/cron/daily` at 10:00 UTC) in prod; node-cron in `server.ts` for local dev
- **UI:** Tailwind CSS v3 + custom Radix UI-based components (NOT the new shadcn v4 — replaced with v3-compatible versions)
- **Deploy target:** Vercel (app + cron) + Railway (PostgreSQL addon)

## Key Files
- `server.ts` — custom Next.js server, seeds default user, starts cron after server.listen()
- `src/lib/db/schema.ts` — all 8 Drizzle table definitions + shared types
- `src/lib/services/openai.ts` — all 7 LLM prompt functions with lazy `getClient()` (includes `scoreCompetitor`, `compareProducts`)
- `src/lib/services/companyProducts.ts` — sync + query user's own product catalog for AI matching
- `src/lib/scoring.ts` — `computeRecencyPenalty` + `computeFinalScore`
- `src/lib/modules/index.ts` — module orchestrator (creates module_runs, catches errors)
- `src/jobs/scheduler.ts` — daily cron at 06:00 ET
- `src/app/company/products/page.tsx` — product catalog management UI
- `src/app/company/products/[id]/page.tsx` — product detail page with edit/delete and related competitor events
- `src/app/api/company/products/route.ts` — CRUD API for company products
- `src/app/api/company/products/[id]/route.ts` — GET/PUT/DELETE single product
- `src/app/api/company/products/[id]/events/route.ts` — related competitor events for a product (JSONB `?` query)
- `src/app/api/company/products/event-counts/route.ts` — event counts per product for catalog badges
- `src/components/EventCard.tsx` — reusable event card component (used by feed page and product detail page)
- `src/components/ProductComparisonDialog.tsx` — AI product comparison dialog with clickable product cards

## Important Decisions
- **Single user:** hardcoded UUID `'00000000-0000-0000-0000-000000000001'` seeded on startup
- **Idempotency:** `UNIQUE(competitor_id, module_type, external_id)` + `.onConflictDoNothing()` + `.returning()` guard — resync does NOT clear old events; idempotency handles duplicates naturally
- **Score recomputation:** `events.raw_data JSONB` stores full payload; `relevance_scores` is separate table
- **Snapshot pruning:** Products module deletes snapshots older than 30 days after each sync
- **Dynamic routes:** Root `page.tsx` and `/api/modules/status` need `export const dynamic = "force-dynamic"` to prevent static prerendering
- **OpenAI client:** MUST be lazy (`getClient()` function, not module-level const) or Next.js build fails
- **Product batching:** gpt-4o-mini drops fields on 60+ item inputs — products are batched in groups of 20
- **Company product matching:** All AI scoring prompts receive the user's product catalog for competitive matching; `matchedProducts` stored in `relevance_scores`
- **Product comparison dialog:** Clickable "Affects: Your X" pills in feed open a Radix Dialog with live AI comparison via `compareProducts()` — results are not cached, each click triggers a fresh analysis. Both product cards in the dialog are clickable: competitor card opens source URL in new tab, company card navigates to product detail page
- **Product detail page:** `/company/products/[id]` shows full product info, inline edit form (title, description, price, type, image URL), delete with confirmation dialog, and related competitor events. Clicking an event card opens the comparison dialog
- **EventCard component:** Shared component for rendering event cards consistently across feed and product detail pages. Handles product_launch (image+price+AI analysis) and other types (title+summary). Configurable via props for matched product pills, expandable reasoning, click handlers
- **Sidebar active state:** Uses shadow detection algorithm so `/company/products/[id]` highlights "Your Products" without also highlighting "Company Profile"
- **Feed sorting:** Primary sort by date or score, with secondary sort as tiebreaker (date→score or score→date)

## Database Migrations

This project does NOT use migration files. Schema changes are applied via `drizzle-kit push`, which diffs `src/lib/db/schema.ts` against the live DB and applies changes directly.

- **After any schema change**, run: `npx drizzle-kit push`
- This also runs automatically on deploy via the `postbuild` script
- Fails locally without `DATABASE_URL` set — that's expected

## Known Issues / Limitations
- Module D (jobs) uses cheerio — won't work on JS-rendered career pages (most modern sites)
- shadcn v4 components were replaced: the auto-generated ones use `@base-ui/react` + Tailwind v4 which is incompatible. Custom Radix UI + CVA components in `src/components/ui/`
- `postbuild` runs `drizzle-kit push` which fails locally without DATABASE_URL — normal/expected
- Company product auto-fetch only works for Shopify stores; non-Shopify sites need manual product entry

## Workflow for New Feature Requests

After every new feature request, Claude must output the following before implementing:

1. **ACCEPTANCE CRITERIA** — Clear, testable criteria for the feature
2. **ASK ME QUESTIONS** — Clarifying questions before making assumptions
3. **ANY ASSUMPTIONS MADE** — Explicit assumptions so the user can correct them

## Env Vars Required
DATABASE_URL, OPENAI_API_KEY, NEWS_API_KEY, TAVILY_API_KEY
