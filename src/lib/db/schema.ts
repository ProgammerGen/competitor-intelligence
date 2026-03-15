import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const moduleTypeEnum = pgEnum("module_type", [
  "news",
  "product_launch",
  "review",
  "job_posting",
]);

export const moduleStatusEnum = pgEnum("module_status", [
  "running",
  "success",
  "error",
]);

export const sentimentLabelEnum = pgEnum("sentiment_label", [
  "Positive",
  "Neutral",
  "Negative",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userCompanies = pgTable("user_companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  domain: text("domain").unique().notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  industry: text("industry").notNull(),
  targetCustomer: jsonb("target_customer")
    .$type<{ ageRange: string; geography: string; traits: string[] }>()
    .notNull(),
  whyCustomersBuy: text("why_customers_buy").notNull(),
  confirmed: boolean("confirmed").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const companyProducts = pgTable(
  "company_products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userCompanyId: uuid("user_company_id")
      .references(() => userCompanies.id)
      .notNull(),
    title: text("title").notNull(),
    handle: text("handle"),
    description: text("description"),
    price: text("price"),
    imageUrl: text("image_url"),
    productType: text("product_type"),
    sourceType: text("source_type").default("auto").notNull(),
    externalId: text("external_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("company_products_idempotency_idx").on(t.userCompanyId, t.externalId)]
);

export const trackedCompetitors = pgTable(
  "tracked_competitors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userCompanyId: uuid("user_company_id")
      .references(() => userCompanies.id)
      .notNull(),
    domain: text("domain").notNull(),
    name: text("name").notNull(),
    similarityScore: integer("similarity_score").notNull(),
    whySimilar: text("why_similar").notNull(),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("competitors_company_domain_idx").on(t.userCompanyId, t.domain)]
);

export const productSnapshots = pgTable("product_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  competitorId: uuid("competitor_id")
    .references(() => trackedCompetitors.id)
    .notNull(),
  syncedAt: timestamp("synced_at").defaultNow().notNull(),
  products: jsonb("products").$type<ShopifyProduct[]>().notNull(),
});

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    competitorId: uuid("competitor_id")
      .references(() => trackedCompetitors.id)
      .notNull(),
    moduleType: moduleTypeEnum("module_type").notNull(),
    title: text("title").notNull(),
    sourceUrl: text("source_url").notNull(),
    eventOccurredAt: timestamp("event_occurred_at").notNull(),
    detectedAt: timestamp("detected_at").defaultNow().notNull(),
    rawData: jsonb("raw_data").notNull(),
    externalId: text("external_id").notNull(),
  },
  (t) => [
    uniqueIndex("events_idempotency_idx").on(
      t.competitorId,
      t.moduleType,
      t.externalId
    ),
  ]
);

export const relevanceScores = pgTable("relevance_scores", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id")
    .references(() => events.id)
    .unique()
    .notNull(),
  signalStrength: integer("signal_strength").notNull(),
  signalReasoning: text("signal_reasoning").notNull(),
  sentimentLabel: sentimentLabelEnum("sentiment_label").notNull(),
  sentimentScore: numeric("sentiment_score").notNull(),
  summary: text("summary").notNull(),
  isNoise: boolean("is_noise").notNull(),
  recencyPenalty: integer("recency_penalty").notNull(),
  finalScore: integer("final_score").notNull(),
  matchedProducts: jsonb("matched_products").$type<string[]>(),
  scoredAt: timestamp("scored_at").defaultNow().notNull(),
});

export const moduleRuns = pgTable("module_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  competitorId: uuid("competitor_id")
    .references(() => trackedCompetitors.id)
    .notNull(),
  moduleType: moduleTypeEnum("module_type").notNull(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  status: moduleStatusEnum("status").notNull(),
  errorMessage: text("error_message"),
});

// Shared types used across the codebase
export interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  body_html?: string;
  created_at: string;
  updated_at: string;
  vendor?: string;
  product_type?: string;
  tags?: string[];
  variants: Array<{ price: string; title: string }>;
  images: Array<{ src: string }>;
}

export type UserCompany = typeof userCompanies.$inferSelect;
export type TrackedCompetitor = typeof trackedCompetitors.$inferSelect;
export type Event = typeof events.$inferSelect;
export type CompanyProduct = typeof companyProducts.$inferSelect;
export type RelevanceScore = typeof relevanceScores.$inferSelect;