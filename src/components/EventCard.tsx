"use client";

import React from "react";
import {
  ExternalLink,
  Newspaper,
  ShoppingBag,
  Globe,
  Briefcase,
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

export interface EventCardRow {
  event: {
    id: string;
    moduleType: string;
    title: string;
    sourceUrl: string;
    eventOccurredAt: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rawData?: any;
  };
  score: {
    signalStrength: number;
    signalReasoning: string;
    sentimentLabel: string;
    summary: string;
    finalScore: number;
    matchedProducts?: string[] | null;
  };
  competitor: { id: string; name: string; domain: string };
}

export interface EventCardProps {
  row: EventCardRow;
  /** Called when the entire card is clicked (e.g. open comparison dialog) */
  onClick?: () => void;
  /** Company name for bolding in AI summaries */
  companyName?: string;
  /** Show "Affects: Your X" pills */
  showMatchedProducts?: boolean;
  /** Called when a matched product pill is clicked */
  onMatchedProductClick?: (name: string) => void;
  /** Show expandable signal reasoning toggle */
  showExpandableReasoning?: boolean;
  /** Whether signal reasoning is currently expanded */
  isExpanded?: boolean;
  /** Called when expand/collapse is toggled */
  onToggleExpand?: () => void;
  /** CSS animation class */
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

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

const MODULE_LABELS: Record<string, { label: string; icon: typeof Newspaper }> = {
  news: { label: "News", icon: Newspaper },
  product_launch: { label: "Product Launches", icon: ShoppingBag },
  review: { label: "Web Search", icon: Globe },
  job_posting: { label: "Jobs", icon: Briefcase },
};

const SENTIMENT_CONFIG: Record<string, { class: string; dot: string }> = {
  Positive: { class: "text-emerald-700", dot: "bg-emerald-500" },
  Neutral: { class: "text-slate-500", dot: "bg-slate-400" },
  Negative: { class: "text-red-600", dot: "bg-red-500" },
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

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

function highlightCompanyName(text: string, name: string): React.ReactNode {
  if (!name || !text.includes(name)) return text;
  const parts = text.split(name);
  return parts.reduce<React.ReactNode[]>((acc, part, i) => {
    if (i > 0) acc.push(<strong key={i} className="text-foreground font-semibold">{name}</strong>);
    acc.push(part);
    return acc;
  }, []);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function EventCard({
  row,
  onClick,
  companyName,
  showMatchedProducts = false,
  onMatchedProductClick,
  showExpandableReasoning = false,
  isExpanded = false,
  onToggleExpand,
  className = "",
}: EventCardProps) {
  const isProductLaunch = row.event.moduleType === "product_launch";
  const raw = row.event.rawData;
  const sentiment = SENTIMENT_CONFIG[row.score.sentimentLabel] ?? SENTIMENT_CONFIG.Neutral;
  const modInfo = MODULE_LABELS[row.event.moduleType];
  const TabIcon = modInfo?.icon ?? Globe;

  // Product launch specific data
  const imageUrl = isProductLaunch ? (raw?.images as Array<{ src: string }>)?.[0]?.src : undefined;
  const price = isProductLaunch
    ? formatPrice(raw?.variants as Array<{ price: string; title: string }>)
    : null;
  const variantCount = isProductLaunch
    ? ((raw?.variants as unknown[])?.length ?? 0)
    : 0;

  const summaryContent = companyName
    ? highlightCompanyName(row.score.summary, companyName)
    : row.score.summary;

  return (
    <div
      className={`card-elevated overflow-hidden ${onClick ? "cursor-pointer hover:border-primary/30 hover:shadow-sm transition-all" : ""} ${className}`}
      onClick={onClick}
    >
      <div className="flex">
        <div className={`module-indicator ${MODULE_BAR_COLORS[row.event.moduleType] ?? "bg-slate-400"}`} />

        <div className={`flex-1 ${isProductLaunch ? "p-5" : "p-4"} min-w-0`}>
          {/* Header: competitor + module badge + sentiment + date */}
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {row.competitor.name}
            </span>
            {!isProductLaunch && (
              <span
                className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                  MODULE_COLORS[row.event.moduleType] ?? ""
                }`}
              >
                <TabIcon className="h-3 w-3" />
                {modInfo?.label ?? row.event.moduleType}
              </span>
            )}
            <span className={`flex items-center gap-1 text-[11px] font-medium ${sentiment.class}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${sentiment.dot}`} />
              {row.score.sentimentLabel}
            </span>
            {isProductLaunch && (
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDate(row.event.eventOccurredAt)}
              </span>
            )}
          </div>

          {/* Product launch: image + title + price */}
          {isProductLaunch ? (
            <div className="flex gap-4 mb-2">
              <div className="flex-shrink-0">
                {imageUrl ? (
                  <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted border border-border/60">
                    <img
                      src={imageUrl}
                      alt={row.event.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center">
                    <ShoppingBag className="h-6 w-6 text-purple-300" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base leading-snug mb-1">{row.event.title}</h3>
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
              </div>
            </div>
          ) : (
            <h3 className="font-semibold text-[15px] leading-snug mb-1.5">{row.event.title}</h3>
          )}

          {/* AI Summary */}
          {isProductLaunch ? (
            <div className="bg-muted/40 rounded-lg p-3 mb-2">
              <div className="flex items-start gap-2">
                <Lightbulb className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-0.5">
                    AI Analysis — How this affects your business
                  </p>
                  <p className="text-sm text-foreground leading-relaxed">
                    {summaryContent}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground leading-relaxed mb-2">
              {summaryContent}
            </p>
          )}

          {/* Matched company products pills */}
          {showMatchedProducts && row.score.matchedProducts && row.score.matchedProducts.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {row.score.matchedProducts.map((name) => (
                <button
                  key={name}
                  onClick={(e) => {
                    e.stopPropagation();
                    onMatchedProductClick?.(name);
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-medium bg-red-50 text-red-700 ring-1 ring-red-200 rounded-full px-2.5 py-0.5 hover:bg-red-100 hover:ring-red-300 transition-colors cursor-pointer"
                >
                  <Target className="h-3 w-3" />
                  Affects: Your {name}
                </button>
              ))}
            </div>
          )}

          {/* Expandable signal reasoning */}
          {showExpandableReasoning && row.score.signalReasoning && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand?.();
              }}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors mb-2"
            >
              {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {isExpanded ? "Hide detailed reasoning" : "Show why this was flagged"}
            </button>
          )}
          {showExpandableReasoning && isExpanded && row.score.signalReasoning && (
            <div className="bg-blue-50/50 rounded-lg p-3 mb-2 animate-fade-in border border-blue-100">
              <p className="text-xs font-semibold text-blue-700 mb-1">Signal Reasoning</p>
              <p className="text-xs text-blue-900/70 leading-relaxed">
                {row.score.signalReasoning}
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {isProductLaunch ? (
              <span className={`flex items-center gap-1 font-medium ${sentiment.class}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${sentiment.dot}`} />
                {row.score.sentimentLabel}
              </span>
            ) : (
              <span title={new Date(row.event.eventOccurredAt).toLocaleString()}>
                {timeAgo(row.event.eventOccurredAt)}
              </span>
            )}
            <span>Signal: {row.score.signalStrength}/100</span>
            {row.event.sourceUrl && (
              <a
                href={row.event.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-foreground transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                {isProductLaunch ? "View product" : "View source"} <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>

        {/* Score */}
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
}
