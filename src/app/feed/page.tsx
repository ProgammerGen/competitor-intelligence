"use client";

import React, { useState, useMemo } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  ExternalLink,
  Search,
  SlidersHorizontal,
  TrendingUp,
  BarChart3,
  Newspaper,
  ShoppingBag,
  Globe,
  Briefcase,
  ArrowUpRight,
  Calendar,
  DollarSign,
  Lightbulb,
  Clock,
  ChevronDown,
  ChevronUp,
  Target,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ProductRawData {
  id?: number;
  title?: string;
  handle?: string;
  created_at?: string;
  updated_at?: string;
  variants?: Array<{ price: string; title: string }>;
  images?: Array<{ src: string }>;
  // Tavily fallback shape
  url?: string;
  description?: string;
  publishedAt?: string;
}

interface EventRow {
  event: {
    id: string;
    moduleType: "news" | "product_launch" | "review" | "job_posting";
    title: string;
    sourceUrl: string;
    eventOccurredAt: string;
    detectedAt: string;
    rawData?: ProductRawData;
  };
  score: {
    signalStrength: number;
    signalReasoning: string;
    sentimentLabel: "Positive" | "Neutral" | "Negative";
    summary: string;
    finalScore: number;
    matchedProducts?: string[] | null;
  };
  competitor: { id: string; name: string; domain: string };
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

type TabKey = "product_launch" | "news" | "review" | "job_posting";

const TABS: { key: TabKey; label: string; icon: typeof ShoppingBag; desc: string; detail: string }[] = [
  {
    key: "product_launch",
    label: "Product Launches",
    icon: ShoppingBag,
    desc: "New products from competitors",
    detail: "Track new product launches, pricing changes, and catalog updates from your competitors over the past 6 months. Each launch is analyzed by AI to explain how it compares to your offerings and what it means for your market position.",
  },
  {
    key: "news",
    label: "News",
    icon: Newspaper,
    desc: "Press & media coverage",
    detail: "Media articles, press releases, and industry coverage mentioning your competitors. AI scores each article by how much it could impact your competitive position — funding rounds, partnerships, and market expansions rank highest.",
  },
  {
    key: "review",
    label: "Web Search",
    icon: Globe,
    desc: "Web mentions & reviews",
    detail: "Brand mentions, customer reviews, forum discussions, and online chatter about your competitors. Useful for spotting reputation shifts, customer complaints, or emerging praise that could signal competitive threats or opportunities.",
  },
  {
    key: "job_posting",
    label: "Jobs",
    icon: Briefcase,
    desc: "Hiring signals",
    detail: "Open roles and hiring patterns that reveal competitor strategy — new engineering hires may signal product investment, sales expansion could mean market push, and executive searches can indicate pivots or growth plans.",
  },
];

const MODULE_COLORS: Record<string, string> = {
  news: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  product_launch: "bg-purple-50 text-purple-700 ring-1 ring-purple-200",
  review: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  job_posting: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
};

const MODULE_BAR_COLORS: Record<string, string> = {
  news: "bg-blue-500",
  product_launch: "bg-purple-500",
  review: "bg-amber-500",
  job_posting: "bg-emerald-500",
};

const SENTIMENT_CONFIG: Record<string, { class: string; dot: string }> = {
  Positive: { class: "text-emerald-700", dot: "bg-emerald-500" },
  Neutral: { class: "text-slate-500", dot: "bg-slate-400" },
  Negative: { class: "text-red-600", dot: "bg-red-500" },
};

function scoreColor(score: number) {
  if (score >= 80) return "bg-red-500 text-white";
  if (score >= 60) return "bg-amber-500 text-white";
  if (score >= 40) return "bg-yellow-400 text-yellow-900";
  return "bg-slate-200 text-slate-600";
}

function scoreLabel(score: number) {
  if (score >= 80) return "Critical";
  if (score >= 60) return "Important";
  if (score >= 40) return "Notable";
  return "Low";
}

function highlightCompanyName(text: string, name: string): React.ReactNode {
  if (!name || !text.includes(name)) return text;
  const parts = text.split(name);
  return parts.reduce<React.ReactNode[]>((acc, part, i) => {
    if (i > 0) acc.push(<strong key={i} className="text-foreground font-semibold">{name}</strong>);
    acc.push(part);
    return acc;
  }, []);
}

function timeAgo(date: string) {
  const diff = (Date.now() - new Date(date).getTime()) / 1000;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(date).toLocaleDateString();
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatPrice(variants?: Array<{ price: string; title: string }>) {
  if (!variants || variants.length === 0) return null;
  const prices = variants
    .map((v) => parseFloat(v.price))
    .filter((p) => !isNaN(p) && p > 0);
  if (prices.length === 0) return null;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (min === max) return `$${min.toFixed(2)}`;
  return `$${min.toFixed(2)} – $${max.toFixed(2)}`;
}

function monthLabel(date: string) {
  return new Date(date).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;
const PAGE_SIZE = 50;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function FeedPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("product_launch");
  const [competitorId, setCompetitorId] = useState("");
  const [minScore, setMinScore] = useState(0);
  const [sort, setSort] = useState<"score" | "date">("date");
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const { data: competitors } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["competitors"],
    queryFn: () => fetch("/api/competitors").then((r) => r.json()),
  });

  const { data: company } = useQuery<{ name: string } | null>({
    queryKey: ["company"],
    queryFn: () => fetch("/api/company").then((r) => r.json()),
    staleTime: 60_000,
  });
  const companyName = company?.name ?? "";

  // Build query params — always filter by current tab's moduleType
  const params = new URLSearchParams();
  if (competitorId) params.set("competitorId", competitorId);
  params.set("moduleType", activeTab);
  params.set("minScore", String(minScore));
  params.set("sort", activeTab === "product_launch" ? "date" : sort);
  params.set("limit", String(PAGE_SIZE));

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery<EventRow[]>({
    queryKey: ["events", competitorId, activeTab, minScore, sort],
    queryFn: ({ pageParam = 0 }) => {
      params.set("offset", String(pageParam as number));
      return fetch(`/api/events?${params.toString()}`).then((r) => r.json());
    },
    getNextPageParam: (lastPage, pages) =>
      lastPage.length === PAGE_SIZE ? pages.length * PAGE_SIZE : undefined,
    initialPageParam: 0,
  });

  const allEvents = data?.pages.flat() ?? [];

  // For product launches: filter to past 6 months and group by month
  const productEvents = useMemo(() => {
    if (activeTab !== "product_launch") return [];
    const cutoff = Date.now() - SIX_MONTHS_MS;
    return allEvents.filter(
      (e) => new Date(e.event.eventOccurredAt).getTime() >= cutoff
    );
  }, [allEvents, activeTab]);

  const productsByMonth = useMemo(() => {
    const groups: Record<string, EventRow[]> = {};
    for (const e of productEvents) {
      const key = monthLabel(e.event.eventOccurredAt);
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    }
    return Object.entries(groups);
  }, [productEvents]);

  const toggleExpand = (id: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Events for non-product tabs
  const otherEvents = activeTab !== "product_launch" ? allEvents : [];

  // Stats
  const displayEvents = activeTab === "product_launch" ? productEvents : otherEvents;
  const highPriority = displayEvents.filter((e) => e.score.finalScore >= 60).length;

  return (
    <div className="ml-[240px]">
      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="page-header">
          <h1>Intelligence Feed</h1>
          <p className="max-w-2xl">
            Your personalized stream of competitive signals, organized by type. Every event is automatically
            detected, analyzed by AI, and scored based on relevance to your business.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-card rounded-xl border border-border/60 p-1.5 shadow-sm">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key);
                  setSort(tab.key === "product_launch" ? "date" : "score");
                }}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab detail card */}
        <div className="card-elevated p-4 mb-5 bg-muted/30 animate-fade-in">
          <div className="flex items-start gap-3">
            {(() => {
              const tab = TABS.find((t) => t.key === activeTab);
              const Icon = tab?.icon ?? Globe;
              return <Icon className="h-4.5 w-4.5 text-primary mt-0.5 flex-shrink-0" />;
            })()}
            <div>
              <h3 className="text-sm font-semibold mb-0.5">
                {TABS.find((t) => t.key === activeTab)?.desc}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {TABS.find((t) => t.key === activeTab)?.detail}
              </p>
            </div>
          </div>
        </div>

        {/* Score legend */}
        <div className="flex items-center gap-4 mb-5 text-[11px]">
          <span className="text-muted-foreground font-medium uppercase tracking-wider">Scores:</span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" />
            <span className="text-muted-foreground">80+ Critical</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="text-muted-foreground">60-79 Important</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-400" />
            <span className="text-muted-foreground">40-59 Notable</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-slate-300" />
            <span className="text-muted-foreground">&lt;40 Low</span>
          </span>
        </div>

        {/* Quick stats */}
        {!isLoading && displayEvents.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-6 animate-fade-in">
            <div className="card-elevated p-4">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {activeTab === "product_launch" ? "Launches" : "Signals"}
                </span>
              </div>
              <p className="text-2xl font-bold">{displayEvents.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {activeTab === "product_launch" ? "in the past 6 months" : "in current view"}
              </p>
            </div>
            <div className="card-elevated p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-amber-500" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">High relevance</span>
              </div>
              <p className="text-2xl font-bold text-amber-600">{highPriority}</p>
              <p className="text-xs text-muted-foreground mt-0.5">scored 60 or above</p>
            </div>
            <div className="card-elevated p-4">
              <div className="flex items-center gap-2 mb-1">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Competitors</span>
              </div>
              <p className="text-2xl font-bold">
                {new Set(displayEvents.map((e) => e.competitor.id)).size}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">with activity</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="filter-bar mb-6">
          <div className="flex items-center gap-2 text-muted-foreground mr-1" title="Filter events by competitor, sort order, or minimum relevance score">
            <SlidersHorizontal className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Filters</span>
          </div>

          <Select value={competitorId || "all"} onValueChange={(v) => setCompetitorId(v === "all" ? "" : v)}>
            <SelectTrigger className="w-44 bg-background">
              <SelectValue placeholder="All competitors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All competitors</SelectItem>
              {competitors?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {activeTab !== "product_launch" && (
            <Select value={sort} onValueChange={(v) => setSort(v as "score" | "date")}>
              <SelectTrigger className="w-36 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="score">By relevance</SelectItem>
                <SelectItem value="date">Most recent</SelectItem>
              </SelectContent>
            </Select>
          )}

          <div className="flex items-center gap-3 flex-1 min-w-48">
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              Min score: <span className="font-semibold text-foreground">{minScore}</span>
            </span>
            <Slider
              value={[minScore]}
              onValueChange={([v]) => setMinScore(v)}
              min={0}
              max={80}
              step={10}
              className="flex-1"
            />
          </div>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="space-y-4">
            <div className="card-elevated p-4">
              <p className="text-sm text-muted-foreground">
                {activeTab === "product_launch"
                  ? "Fetching product launches from your competitors..."
                  : "Fetching your latest competitive signals..."}
              </p>
            </div>
            {activeTab === "product_launch"
              ? [...Array(4)].map((_, i) => (
                  <div key={i} className="card-elevated p-5">
                    <div className="flex gap-5">
                      <Skeleton className="w-20 h-20 rounded-lg flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-2/3" />
                      </div>
                    </div>
                  </div>
                ))
              : [...Array(5)].map((_, i) => (
                  <div key={i} className="card-elevated p-5">
                    <div className="flex gap-4">
                      <Skeleton className="w-1 h-16 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-3 w-full" />
                      </div>
                      <Skeleton className="h-8 w-10 rounded-full" />
                    </div>
                  </div>
                ))}
          </div>
        )}

        {isError && (
          <div className="card-elevated p-8 text-center">
            <p className="text-destructive font-medium">Failed to load feed</p>
            <p className="text-muted-foreground text-sm mt-1">
              We couldn&apos;t retrieve your competitive signals. Please check your connection and refresh.
            </p>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && displayEvents.length === 0 && (
          <div className="card-elevated p-12 text-center">
            {(() => {
              const tab = TABS.find((t) => t.key === activeTab);
              const Icon = tab?.icon ?? Search;
              return (
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <Icon className="h-6 w-6 text-muted-foreground" />
                </div>
              );
            })()}
            <p className="text-lg font-semibold mb-2">
              {activeTab === "product_launch"
                ? "No product launches found"
                : activeTab === "news"
                ? "No news articles found"
                : activeTab === "review"
                ? "No web mentions found"
                : "No job postings found"}
            </p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-3">
              {minScore > 0 || competitorId
                ? "No events match your current filters. Try lowering the minimum score or selecting \"All competitors\"."
                : activeTab === "product_launch"
                ? "No product launches have been detected in the past 6 months. This could mean modules are still collecting data, or competitors haven't launched new products recently."
                : activeTab === "news"
                ? "No news articles have been collected yet. The news module scans for press releases, media coverage, and industry articles mentioning your competitors."
                : activeTab === "review"
                ? "No web mentions detected yet. This module searches for brand mentions, customer reviews, and online discussions about your competitors."
                : "No job postings found yet. The jobs module monitors competitor career pages for open roles that reveal strategic priorities."}
            </p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-6">
              {!(minScore > 0 || competitorId) &&
                "Data syncs automatically every day at 6:00 AM ET. You can also trigger a manual sync from the Monitoring page."}
            </p>
            <div className="flex items-center justify-center gap-3">
              {(minScore > 0 || competitorId) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setMinScore(0);
                    setCompetitorId("");
                  }}
                >
                  Clear filters
                </Button>
              )}
              <Link href="/monitoring">
                <Button variant="outline" size="sm">
                  Check monitoring status
                  <ArrowUpRight className="h-3.5 w-3.5 ml-1.5" />
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/*  PRODUCT LAUNCHES TAB                                        */}
        {/* ============================================================ */}
        {activeTab === "product_launch" && !isLoading && productsByMonth.length > 0 && (
          <div className="space-y-8">
            {productsByMonth.map(([month, events]) => (
              <div key={month}>
                {/* Month header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center gap-2 bg-purple-50 text-purple-700 rounded-full px-3 py-1">
                    <Calendar className="h-3.5 w-3.5" />
                    <span className="text-xs font-semibold">{month}</span>
                  </div>
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">
                    {events.length} launch{events.length !== 1 ? "es" : ""}
                  </span>
                </div>

                {/* Product cards */}
                <div className="space-y-3">
                  {events.map((row, idx) => {
                    const raw = row.event.rawData;
                    const imageUrl = raw?.images?.[0]?.src;
                    const price = formatPrice(raw?.variants);
                    const variantCount = raw?.variants?.length ?? 0;
                    const isExpanded = expandedCards.has(row.event.id);

                    return (
                      <div
                        key={row.event.id}
                        className={`card-elevated overflow-hidden animate-fade-in ${
                          idx < 5 ? `animate-fade-in-delay-${idx}` : ""
                        }`}
                      >
                        <div className="flex">
                          {/* Purple left bar */}
                          <div className="module-indicator bg-purple-500" />

                          <div className="flex-1 p-5 min-w-0">
                            <div className="flex gap-4">
                              {/* Product image */}
                              <div className="flex-shrink-0">
                                {imageUrl ? (
                                  <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted border border-border/60">
                                    <img
                                      src={imageUrl}
                                      alt={row.event.title}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = "none";
                                        (e.target as HTMLImageElement).parentElement!.classList.add(
                                          "flex",
                                          "items-center",
                                          "justify-center"
                                        );
                                        const icon = document.createElement("div");
                                        icon.innerHTML = "📦";
                                        icon.className = "text-2xl";
                                        (e.target as HTMLImageElement).parentElement!.appendChild(icon);
                                      }}
                                    />
                                  </div>
                                ) : (
                                  <div className="w-20 h-20 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center">
                                    <ShoppingBag className="h-6 w-6 text-purple-300" />
                                  </div>
                                )}
                              </div>

                              <div className="flex-1 min-w-0">
                                {/* Competitor + date */}
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                    {row.competitor.name}
                                  </span>
                                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {formatDate(row.event.eventOccurredAt)}
                                  </span>
                                </div>

                                {/* Product name */}
                                <h3 className="font-semibold text-base leading-snug mb-1">
                                  {row.event.title}
                                </h3>

                                {/* Price + variants */}
                                <div className="flex flex-wrap items-center gap-3 mb-2">
                                  {price && (
                                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-foreground">
                                      <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                                      {price}
                                    </span>
                                  )}
                                  {variantCount > 1 && (
                                    <span className="text-xs text-muted-foreground">
                                      {variantCount} variant{variantCount !== 1 ? "s" : ""}
                                    </span>
                                  )}
                                </div>

                                {/* AI Summary — what the product does & relevance */}
                                <div className="bg-muted/40 rounded-lg p-3 mb-2">
                                  <div className="flex items-start gap-2">
                                    <Lightbulb className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                                    <div>
                                      <p className="text-xs font-semibold text-muted-foreground mb-0.5">
                                        AI Analysis — How this affects your business
                                      </p>
                                      <p className="text-sm text-foreground leading-relaxed">
                                        {companyName
                                          ? highlightCompanyName(row.score.summary, companyName)
                                          : row.score.summary}
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                {/* Matched company products */}
                                {row.score.matchedProducts && row.score.matchedProducts.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 mb-2">
                                    {row.score.matchedProducts.map((name) => (
                                      <span
                                        key={name}
                                        className="inline-flex items-center gap-1 text-[11px] font-medium bg-red-50 text-red-700 ring-1 ring-red-200 rounded-full px-2.5 py-0.5"
                                      >
                                        <Target className="h-3 w-3" />
                                        Affects: Your {name}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {/* Expandable signal reasoning */}
                                {row.score.signalReasoning && (
                                  <button
                                    onClick={() => toggleExpand(row.event.id)}
                                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors mb-2"
                                  >
                                    {isExpanded ? (
                                      <ChevronUp className="h-3 w-3" />
                                    ) : (
                                      <ChevronDown className="h-3 w-3" />
                                    )}
                                    {isExpanded ? "Hide detailed reasoning" : "Show why this was flagged"}
                                  </button>
                                )}
                                {isExpanded && row.score.signalReasoning && (
                                  <div className="bg-blue-50/50 rounded-lg p-3 mb-2 animate-fade-in border border-blue-100">
                                    <p className="text-xs font-semibold text-blue-700 mb-1">Signal Reasoning</p>
                                    <p className="text-xs text-blue-900/70 leading-relaxed">
                                      {row.score.signalReasoning}
                                    </p>
                                  </div>
                                )}

                                {/* Footer */}
                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                  <span className={`flex items-center gap-1 font-medium ${SENTIMENT_CONFIG[row.score.sentimentLabel]?.class ?? ""}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${SENTIMENT_CONFIG[row.score.sentimentLabel]?.dot ?? ""}`} />
                                    {row.score.sentimentLabel}
                                  </span>
                                  <span>Signal: {row.score.signalStrength}/100</span>
                                  {row.event.sourceUrl && (
                                    <a
                                      href={row.event.sourceUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                                    >
                                      View product <ExternalLink className="w-3 h-3" />
                                    </a>
                                  )}
                                </div>
                              </div>

                              {/* Score */}
                              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                                <div className={`score-pill ${scoreColor(row.score.finalScore)}`}>
                                  {row.score.finalScore}
                                </div>
                                <span className="text-[10px] text-muted-foreground font-medium">
                                  {scoreLabel(row.score.finalScore)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ============================================================ */}
        {/*  OTHER TABS (News, Web Search, Jobs)                         */}
        {/* ============================================================ */}
        {activeTab !== "product_launch" && !isLoading && (
          <div className="space-y-3">
            {otherEvents.map((row, idx) => {
              const sentiment = SENTIMENT_CONFIG[row.score.sentimentLabel] ?? SENTIMENT_CONFIG.Neutral;
              const TabIcon = TABS.find((t) => t.key === row.event.moduleType)?.icon ?? Globe;
              return (
                <div
                  key={row.event.id}
                  className={`card-elevated overflow-hidden animate-fade-in ${
                    idx < 5 ? `animate-fade-in-delay-${idx}` : ""
                  }`}
                >
                  <div className="flex">
                    <div className={`module-indicator ${MODULE_BAR_COLORS[row.event.moduleType]}`} />

                    <div className="flex-1 p-4 pl-4 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          {row.competitor.name}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                            MODULE_COLORS[row.event.moduleType]
                          }`}
                        >
                          <TabIcon className="h-3 w-3" />
                          {TABS.find((t) => t.key === row.event.moduleType)?.label}
                        </span>
                        <span
                          className={`flex items-center gap-1 text-[11px] font-medium ${sentiment.class}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${sentiment.dot}`} />
                          {row.score.sentimentLabel}
                        </span>
                      </div>

                      <h3 className="font-semibold text-[15px] leading-snug mb-1.5">{row.event.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed mb-2">
                        {companyName
                          ? highlightCompanyName(row.score.summary, companyName)
                          : row.score.summary}
                      </p>

                      {/* Matched company products */}
                      {row.score.matchedProducts && row.score.matchedProducts.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {row.score.matchedProducts.map((name) => (
                            <span
                              key={name}
                              className="inline-flex items-center gap-1 text-[11px] font-medium bg-red-50 text-red-700 ring-1 ring-red-200 rounded-full px-2.5 py-0.5"
                            >
                              <Target className="h-3 w-3" />
                              Affects: Your {name}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span title={new Date(row.event.eventOccurredAt).toLocaleString()}>
                          {timeAgo(row.event.eventOccurredAt)}
                        </span>
                        <span>Signal: {row.score.signalStrength}/100</span>
                        {row.event.sourceUrl && (
                          <a
                            href={row.event.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 hover:text-foreground transition-colors"
                          >
                            View source <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-center gap-1 p-4 pl-0">
                      <div className={`score-pill ${scoreColor(row.score.finalScore)}`}>
                        {row.score.finalScore}
                      </div>
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {scoreLabel(row.score.finalScore)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Load more */}
        {hasNextPage && (
          <div className="mt-8 text-center">
            <Button
              variant="outline"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="px-8"
            >
              {isFetchingNextPage ? "Loading..." : "Load more"}
            </Button>
            <p className="text-[11px] text-muted-foreground mt-2">
              Showing {displayEvents.length} events
            </p>
          </div>
        )}

        {!isLoading && displayEvents.length > 0 && !hasNextPage && (
          <p className="text-center text-xs text-muted-foreground mt-8 mb-4">
            End of results &middot; {displayEvents.length} total signal{displayEvents.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>
    </div>
  );
}
