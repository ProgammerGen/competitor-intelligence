# Competitor Intelligence App — Project Notes

## Stack
- **Framework:** Next.js 14 (App Router), TypeScript
- **ORM:** Drizzle ORM with pg driver
- **DB:** PostgreSQL (Railway addon in prod, local Postgres in dev)
- **LLM:** OpenAI gpt-4o-mini (lazy-initialized client via `getClient()` in `src/lib/services/openai.ts`)
- **Scheduler:** node-cron in `server.ts` custom server (NOT Vercel — needs persistent process)
- **UI:** Tailwind CSS v3 + custom Radix UI-based components (NOT the new shadcn v4 — replaced with v3-compatible versions)
- **Deploy target:** Railway (single service + PostgreSQL addon)

## Key Files
- `server.ts` — custom Next.js server, seeds default user, starts cron after server.listen()
- `src/lib/db/schema.ts` — all 7 Drizzle table definitions + shared types
- `src/lib/services/openai.ts` — all 5 LLM prompt functions with lazy `getClient()`
- `src/lib/scoring.ts` — `computeRecencyPenalty` + `computeFinalScore`
- `src/lib/modules/index.ts` — module orchestrator (creates module_runs, catches errors)
- `src/jobs/scheduler.ts` — daily cron at 06:00 ET

## Important Decisions
- **Single user:** hardcoded UUID `'00000000-0000-0000-0000-000000000001'` seeded on startup
- **Idempotency:** `UNIQUE(competitor_id, module_type, external_id)` + `.onConflictDoNothing()` + `.returning()` guard
- **Score recomputation:** `events.raw_data JSONB` stores full payload; `relevance_scores` is separate table
- **Snapshot pruning:** Products module deletes snapshots older than 30 days after each sync
- **Dynamic routes:** Root `page.tsx` and `/api/modules/status` need `export const dynamic = "force-dynamic"` to prevent static prerendering
- **OpenAI client:** MUST be lazy (`getClient()` function, not module-level const) or Next.js build fails

## Known Issues / Limitations
- Module D (jobs) uses cheerio — won't work on JS-rendered career pages (most modern sites)
- shadcn v4 components were replaced: the auto-generated ones use `@base-ui/react` + Tailwind v4 which is incompatible. Custom Radix UI + CVA components in `src/components/ui/`
- `postbuild` runs `drizzle-kit push` which fails locally without DATABASE_URL — normal/expected

## Env Vars Required
DATABASE_URL, OPENAI_API_KEY, NEWS_API_KEY, REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET
