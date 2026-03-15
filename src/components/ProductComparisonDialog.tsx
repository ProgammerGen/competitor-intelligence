"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ShoppingBag,
  ArrowUpRight,
  Shield,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Sparkles,
} from "lucide-react";

interface ProductComparison {
  headline: string;
  competitorStrengths: string[];
  competitorWeaknesses: string[];
  threatLevel: "High" | "Medium" | "Low";
  recommendation: string;
}

export interface ProductComparisonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matchedProductName: string;
  companyProduct: {
    title: string;
    description?: string | null;
    price?: string | null;
    imageUrl?: string | null;
    productType?: string | null;
  } | null;
  eventTitle: string;
  moduleType: string;
  competitorName: string;
  rawData?: Record<string, unknown>;
  summary: string;
  signalReasoning: string;
  sentimentLabel: string;
  finalScore: number;
  sourceUrl: string;
  companyProductId?: string | null;
}

function stripHtml(html: string): string {
  if (typeof window !== "undefined") {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return doc.body.textContent || "";
  }
  return html.replace(/<[^>]+>/g, "");
}

function formatVariantPrice(
  variants?: Array<{ price: string; title: string }>
): string | null {
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

function threatColor(level: string) {
  if (level === "High") return "bg-red-100 text-red-700 border-red-200";
  if (level === "Medium") return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-green-100 text-green-700 border-green-200";
}

function threatIcon(level: string) {
  if (level === "High") return <AlertTriangle className="h-3.5 w-3.5" />;
  if (level === "Medium") return <Shield className="h-3.5 w-3.5" />;
  return <Shield className="h-3.5 w-3.5" />;
}

function scoreColor(score: number) {
  if (score >= 80) return "bg-red-500 text-white";
  if (score >= 60) return "bg-amber-500 text-white";
  if (score >= 40) return "bg-yellow-400 text-yellow-900";
  return "bg-slate-200 text-slate-600";
}

export function ProductComparisonDialog({
  open,
  onOpenChange,
  matchedProductName,
  companyProduct,
  eventTitle,
  moduleType,
  competitorName,
  rawData,
  summary,
  signalReasoning,
  sentimentLabel,
  finalScore,
  sourceUrl,
  companyProductId,
}: ProductComparisonDialogProps) {
  const router = useRouter();
  const [comparison, setComparison] = useState<ProductComparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const isProductLaunch = moduleType === "product_launch";

  // Extract competitor product data from rawData
  const competitorImage = (rawData?.images as Array<{ src: string }>)?.[0]?.src;
  const competitorTitle = (rawData?.title as string) || eventTitle;
  const competitorVariants = rawData?.variants as Array<{ price: string; title: string }> | undefined;
  const competitorPrice = formatVariantPrice(competitorVariants);
  const competitorBodyHtml = rawData?.body_html as string | undefined;
  const competitorDescription = competitorBodyHtml
    ? stripHtml(competitorBodyHtml).slice(0, 500)
    : null;

  useEffect(() => {
    if (!open) {
      setComparison(null);
      setError(false);
      return;
    }

    setLoading(true);
    setError(false);

    fetch("/api/products/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyProductName: matchedProductName,
        competitorProductTitle: isProductLaunch ? competitorTitle : undefined,
        competitorProductDescription: isProductLaunch ? competitorDescription : undefined,
        competitorProductPrice: isProductLaunch ? competitorPrice : undefined,
        competitorName,
        moduleType,
        eventSummary: summary,
      }),
    })
      .then((res) => res.json())
      .then((data) => setComparison(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [open, matchedProductName, competitorName, moduleType]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={isProductLaunch ? "max-w-3xl" : "max-w-lg"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {isProductLaunch ? "Product Comparison" : `Impact on Your ${matchedProductName}`}
          </DialogTitle>
          <DialogDescription>
            {isProductLaunch
              ? `${competitorName} vs Your Product`
              : `How this ${moduleType.replace("_", " ")} event affects your product`}
          </DialogDescription>
        </DialogHeader>

        {/* Product cards */}
        {isProductLaunch ? (
          <div className="grid grid-cols-2 gap-4 mt-4">
            {/* Competitor product */}
            <div
              className="rounded-lg border border-border p-4 space-y-3 cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all group"
              onClick={() => sourceUrl && window.open(sourceUrl, "_blank")}
              role="button"
              tabIndex={0}
            >
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {competitorName}
                </p>
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
              </div>
              {competitorImage ? (
                <div className="w-full h-32 rounded-lg overflow-hidden bg-muted border border-border/60">
                  <img
                    src={competitorImage}
                    alt={competitorTitle}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-full h-32 rounded-lg bg-muted flex items-center justify-center">
                  <ShoppingBag className="h-8 w-8 text-muted-foreground/40" />
                </div>
              )}
              <h3 className="font-semibold text-sm leading-tight">{competitorTitle}</h3>
              {competitorPrice && (
                <p className="text-sm font-medium text-foreground">{competitorPrice}</p>
              )}
              {competitorVariants && competitorVariants.length > 1 && (
                <p className="text-xs text-muted-foreground">
                  {competitorVariants.length} variants
                </p>
              )}
              {competitorDescription && (
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">
                  {competitorDescription}
                </p>
              )}
            </div>

            {/* Company product */}
            <div
              className={`rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3 ${
                companyProductId ? "cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all group" : ""
              }`}
              onClick={() => {
                if (companyProductId) {
                  onOpenChange(false);
                  router.push(`/company/products/${companyProductId}`);
                }
              }}
              role={companyProductId ? "button" : undefined}
              tabIndex={companyProductId ? 0 : undefined}
            >
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                  Your Product
                </p>
                {companyProductId && (
                  <ArrowUpRight className="h-3.5 w-3.5 text-primary/40 group-hover:text-primary transition-colors" />
                )}
              </div>
              {companyProduct?.imageUrl ? (
                <div className="w-full h-32 rounded-lg overflow-hidden bg-muted border border-border/60">
                  <img
                    src={companyProduct.imageUrl}
                    alt={companyProduct.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-full h-32 rounded-lg bg-muted flex items-center justify-center">
                  <ShoppingBag className="h-8 w-8 text-muted-foreground/40" />
                </div>
              )}
              <h3 className="font-semibold text-sm leading-tight">
                {companyProduct?.title || matchedProductName}
              </h3>
              {companyProduct?.price && (
                <p className="text-sm font-medium text-foreground">{companyProduct.price}</p>
              )}
              {companyProduct?.productType && (
                <Badge variant="outline" className="text-[10px]">
                  {companyProduct.productType}
                </Badge>
              )}
              {companyProduct?.description ? (
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">
                  {companyProduct.description}
                </p>
              ) : !companyProduct ? (
                <p className="text-xs text-muted-foreground italic">
                  Product details not available — this product may have been removed from your catalog.
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          /* Single-column for non-product-launch events */
          <div className="mt-4 space-y-4">
            <div className="rounded-lg border border-border/60 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Event
              </p>
              <h3 className="font-semibold text-sm">{eventTitle}</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {competitorName} &middot; {moduleType.replace("_", " ")}
              </p>
            </div>

            <div
              className={`rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3 ${
                companyProductId ? "cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all group" : ""
              }`}
              onClick={() => {
                if (companyProductId) {
                  onOpenChange(false);
                  router.push(`/company/products/${companyProductId}`);
                }
              }}
              role={companyProductId ? "button" : undefined}
              tabIndex={companyProductId ? 0 : undefined}
            >
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                  Your Product
                </p>
                {companyProductId && (
                  <ArrowUpRight className="h-3.5 w-3.5 text-primary/40 group-hover:text-primary transition-colors" />
                )}
              </div>
              <div className="flex items-start gap-3">
                {companyProduct?.imageUrl ? (
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted border border-border/60 flex-shrink-0">
                    <img
                      src={companyProduct.imageUrl}
                      alt={companyProduct.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <ShoppingBag className="h-5 w-5 text-muted-foreground/40" />
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm leading-tight">
                    {companyProduct?.title || matchedProductName}
                  </h3>
                  {companyProduct?.price && (
                    <p className="text-sm text-foreground mt-0.5">{companyProduct.price}</p>
                  )}
                  {companyProduct?.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {companyProduct.description}
                    </p>
                  )}
                  {!companyProduct && (
                    <p className="text-xs text-muted-foreground italic mt-1">
                      Product details not available — may have been removed from your catalog.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AI Comparison Results */}
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold">AI Analysis</h4>
          </div>

          {loading && (
            <div className="flex flex-col items-center justify-center py-8 gap-3 animate-fade-in">
              <div className="relative flex items-center justify-center">
                <div className="absolute h-10 w-10 rounded-full border-2 border-primary/20 animate-ping" />
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Sparkles className="h-5 w-5 text-primary animate-pulse" />
                </div>
              </div>
              <p className="text-sm font-medium text-foreground">Analyzing competitive impact...</p>
              <p className="text-xs text-muted-foreground">AI is comparing products and generating insights</p>
            </div>
          )}

          {error && (
            <p className="text-sm text-muted-foreground">
              {summary || "Unable to generate comparison. Please try again."}
            </p>
          )}

          {comparison && !loading && (
            <div className="space-y-3">
              {/* Headline + Threat level */}
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium leading-snug">{comparison.headline}</p>
                <Badge
                  variant="outline"
                  className={`flex-shrink-0 text-[11px] gap-1 ${threatColor(comparison.threatLevel)}`}
                >
                  {threatIcon(comparison.threatLevel)}
                  {comparison.threatLevel} Threat
                </Badge>
              </div>

              {/* Strengths / Weaknesses */}
              {(comparison.competitorStrengths.length > 0 || comparison.competitorWeaknesses.length > 0) && (
                <div className="grid grid-cols-2 gap-3">
                  {comparison.competitorStrengths.length > 0 && (
                    <div className="rounded-lg bg-red-50 p-3 space-y-1.5">
                      <p className="text-[11px] font-semibold text-red-700 flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        Competitor Strengths
                      </p>
                      <ul className="space-y-1">
                        {comparison.competitorStrengths.map((s, i) => (
                          <li key={i} className="text-xs text-red-700/80 leading-relaxed">
                            &bull; {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {comparison.competitorWeaknesses.length > 0 && (
                    <div className="rounded-lg bg-green-50 p-3 space-y-1.5">
                      <p className="text-[11px] font-semibold text-green-700 flex items-center gap-1">
                        <TrendingDown className="h-3 w-3" />
                        Competitor Weaknesses
                      </p>
                      <ul className="space-y-1">
                        {comparison.competitorWeaknesses.map((w, i) => (
                          <li key={i} className="text-xs text-green-700/80 leading-relaxed">
                            &bull; {w}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Recommendation */}
              {comparison.recommendation && (
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-[11px] font-semibold text-foreground mb-1">Recommendation</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {comparison.recommendation}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/60">
          <div className="flex items-center gap-3">
            <span className={`score-pill ${scoreColor(finalScore)}`}>{finalScore}</span>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  sentimentLabel === "Negative"
                    ? "bg-red-500"
                    : sentimentLabel === "Positive"
                    ? "bg-emerald-500"
                    : "bg-slate-400"
                }`}
              />
              {sentimentLabel}
            </div>
          </div>
          {sourceUrl && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => window.open(sourceUrl, "_blank")}
            >
              View source
              <ArrowUpRight className="h-3 w-3 ml-1" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
