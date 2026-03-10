"use client";

import { useState } from "react";
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
import { ExternalLink, Settings } from "lucide-react";

interface EventRow {
  event: {
    id: string;
    moduleType: "news" | "product_launch" | "review" | "job_posting";
    title: string;
    sourceUrl: string;
    eventOccurredAt: string;
    detectedAt: string;
  };
  score: {
    signalStrength: number;
    sentimentLabel: "Positive" | "Neutral" | "Negative";
    summary: string;
    finalScore: number;
  };
  competitor: { id: string; name: string; domain: string };
}

const MODULE_LABELS: Record<string, string> = {
  news: "News",
  product_launch: "Product Launch",
  review: "Reddit",
  job_posting: "Job Posting",
};

const MODULE_COLORS: Record<string, string> = {
  news: "bg-blue-100 text-blue-800",
  product_launch: "bg-purple-100 text-purple-800",
  review: "bg-orange-100 text-orange-800",
  job_posting: "bg-green-100 text-green-800",
};

const SENTIMENT_COLORS: Record<string, string> = {
  Positive: "bg-green-100 text-green-800",
  Neutral: "bg-gray-100 text-gray-800",
  Negative: "bg-red-100 text-red-800",
};

function scoreColor(score: number) {
  if (score >= 80) return "bg-red-600 text-white";
  if (score >= 60) return "bg-orange-500 text-white";
  if (score >= 40) return "bg-yellow-500 text-white";
  return "bg-gray-400 text-white";
}

function timeAgo(date: string) {
  const diff = (Date.now() - new Date(date).getTime()) / 1000;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(date).toLocaleDateString();
}

const PAGE_SIZE = 20;

export default function FeedPage() {
  const [competitorId, setCompetitorId] = useState("");
  const [moduleType, setModuleType] = useState("");
  const [minScore, setMinScore] = useState(0);
  const [sort, setSort] = useState<"score" | "date">("score");

  const { data: competitors } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["competitors"],
    queryFn: () => fetch("/api/competitors").then((r) => r.json()),
  });

  const params = new URLSearchParams();
  if (competitorId) params.set("competitorId", competitorId);
  if (moduleType) params.set("moduleType", moduleType);
  params.set("minScore", String(minScore));
  if (sort) params.set("sort", sort);
  params.set("limit", String(PAGE_SIZE));

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery<EventRow[]>({
    queryKey: ["events", competitorId, moduleType, minScore, sort],
    queryFn: ({ pageParam = 0 }) => {
      params.set("offset", String(pageParam as number));
      return fetch(`/api/events?${params.toString()}`).then((r) => r.json());
    },
    getNextPageParam: (lastPage, pages) =>
      lastPage.length === PAGE_SIZE ? pages.length * PAGE_SIZE : undefined,
    initialPageParam: 0,
  });

  const allEvents = data?.pages.flat() ?? [];

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Intelligence Feed</h1>
        <Link href="/monitoring">
          <Button variant="outline" size="sm">
            <Settings className="w-4 h-4 mr-2" />
            Monitoring
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6 p-4 bg-muted/40 rounded-lg">
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

        <Select value={moduleType || "all"} onValueChange={(v) => setModuleType(v === "all" ? "" : v)}>
          <SelectTrigger className="w-44 bg-background">
            <SelectValue placeholder="All modules" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All modules</SelectItem>
            {Object.entries(MODULE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={(v) => setSort(v as "score" | "date")}>
          <SelectTrigger className="w-36 bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="score">By relevance</SelectItem>
            <SelectItem value="date">By date</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 flex-1 min-w-48">
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            Min score: {minScore}
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

      {isLoading && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-destructive text-sm">Failed to load feed.</p>
      )}

      {!isLoading && allEvents.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg font-medium mb-2">No events yet</p>
          <p className="text-sm">
            Modules are still running.{" "}
            <Link href="/monitoring" className="underline">
              Check monitoring status
            </Link>{" "}
            or adjust your filters.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {allEvents.map((row) => (
          <div key={row.event.id} className="border rounded-lg p-4 hover:bg-muted/20 transition-colors">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{row.competitor.name}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      MODULE_COLORS[row.event.moduleType]
                    }`}
                  >
                    {MODULE_LABELS[row.event.moduleType]}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      SENTIMENT_COLORS[row.score.sentimentLabel]
                    }`}
                  >
                    {row.score.sentimentLabel}
                  </span>
                </div>

                <h3 className="font-medium leading-snug mb-1">{row.event.title}</h3>
                <p className="text-sm text-muted-foreground mb-2">{row.score.summary}</p>

                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{timeAgo(row.event.eventOccurredAt)}</span>
                  <a
                    href={row.event.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    Source <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              <div
                className={`text-sm font-bold px-2 py-1 rounded-md flex-shrink-0 ${scoreColor(
                  row.score.finalScore
                )}`}
              >
                {row.score.finalScore}
              </div>
            </div>
          </div>
        ))}
      </div>

      {hasNextPage && (
        <div className="mt-6 text-center">
          <Button
            variant="outline"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
