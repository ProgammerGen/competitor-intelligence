"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ShoppingBag,
  Plus,
  Trash2,
  RefreshCw,
  Package,
  Tag,
  Activity,
} from "lucide-react";

interface CompanyProduct {
  id: string;
  title: string;
  handle: string | null;
  description: string | null;
  price: string | null;
  imageUrl: string | null;
  productType: string | null;
  sourceType: string;
  externalId: string;
  createdAt: string;
}

export default function CompanyProductsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [syncing, setSyncing] = useState(false);

  const { data: products, isLoading } = useQuery<CompanyProduct[]>({
    queryKey: ["companyProducts"],
    queryFn: () => fetch("/api/company/products").then((r) => r.json()),
  });

  const { data: eventCounts } = useQuery<Record<string, number>>({
    queryKey: ["companyProductEventCounts"],
    queryFn: () => fetch("/api/company/products/event-counts").then((r) => r.json()),
    enabled: !!products && products.length > 0,
  });

  const addProduct = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/company/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          price: price.trim() || undefined,
        }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companyProducts"] });
      setTitle("");
      setDescription("");
      setPrice("");
    },
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      await fetch("/api/company/products", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companyProducts"] });
    },
  });

  const handleResync = async () => {
    setSyncing(true);
    try {
      await fetch("/api/company/products", { method: "PUT" });
      // Wait a moment for the background sync, then refresh
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["companyProducts"] });
        setSyncing(false);
      }, 5000);
    } catch {
      setSyncing(false);
    }
  };

  const autoProducts = products?.filter((p) => p.sourceType === "auto") ?? [];
  const manualProducts = products?.filter((p) => p.sourceType === "manual") ?? [];

  return (
    <div className="ml-[240px]">
      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="page-header">
          <h1>Your Product Catalog</h1>
          <p className="max-w-2xl">
            These are your company&apos;s products. When scoring competitor events, our AI matches
            competitor products against yours to identify direct threats and explain the impact on
            specific products in your lineup.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={handleResync}
            disabled={syncing}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Refresh from website"}
          </Button>
          <span className="text-xs text-muted-foreground">
            {products?.length ?? 0} product{(products?.length ?? 0) !== 1 ? "s" : ""} total
          </span>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="card-elevated p-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="w-14 h-14 rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && (!products || products.length === 0) && (
          <div className="card-elevated p-10 text-center mb-8">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Package className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-lg font-semibold mb-2">No products found</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
              We couldn&apos;t detect any products from your website. You can add your products
              manually below so the AI can match competitor launches against your catalog.
            </p>
          </div>
        )}

        {/* Auto-fetched products */}
        {autoProducts.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Auto-detected from your website ({autoProducts.length})
            </h2>
            <div className="space-y-2">
              {autoProducts.map((p) => (
                <div
                  key={p.id}
                  className="card-elevated p-4 cursor-pointer hover:border-primary/30 hover:shadow-sm transition-all"
                  onClick={() => router.push(`/company/products/${p.id}`)}
                >
                  <div className="flex items-start gap-4">
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt={p.title}
                        className="w-14 h-14 rounded-lg object-cover flex-shrink-0 bg-muted"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <ShoppingBag className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-sm leading-tight">{p.title}</h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            {p.price && (
                              <span className="text-xs text-muted-foreground font-medium">{p.price}</span>
                            )}
                            {p.productType && (
                              <span className="inline-flex items-center gap-1 text-[10px] bg-muted rounded-full px-2 py-0.5 text-muted-foreground">
                                <Tag className="h-2.5 w-2.5" />
                                {p.productType}
                              </span>
                            )}
                            {eventCounts && eventCounts[p.id] > 0 && (
                              <span className="inline-flex items-center gap-1 text-[10px] bg-red-50 text-red-700 ring-1 ring-red-200 rounded-full px-2 py-0.5 font-medium">
                                <Activity className="h-2.5 w-2.5" />
                                {eventCounts[p.id]} competitor signal{eventCounts[p.id] !== 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteProduct.mutate(p.id); }}
                          className="text-muted-foreground hover:text-destructive transition-colors p-1"
                          title="Remove product"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {p.description && (
                        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                          {p.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Manual products */}
        {manualProducts.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Manually added ({manualProducts.length})
            </h2>
            <div className="space-y-2">
              {manualProducts.map((p) => (
                <div
                  key={p.id}
                  className="card-elevated p-4 cursor-pointer hover:border-primary/30 hover:shadow-sm transition-all"
                  onClick={() => router.push(`/company/products/${p.id}`)}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                      <ShoppingBag className="h-5 w-5 text-purple-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-sm leading-tight">{p.title}</h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            {p.price && (
                              <span className="text-xs text-muted-foreground font-medium">{p.price}</span>
                            )}
                            {eventCounts && eventCounts[p.id] > 0 && (
                              <span className="inline-flex items-center gap-1 text-[10px] bg-red-50 text-red-700 ring-1 ring-red-200 rounded-full px-2 py-0.5 font-medium">
                                <Activity className="h-2.5 w-2.5" />
                                {eventCounts[p.id]} competitor signal{eventCounts[p.id] !== 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteProduct.mutate(p.id); }}
                          className="text-muted-foreground hover:text-destructive transition-colors p-1"
                          title="Remove product"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {p.description && (
                        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                          {p.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add product form */}
        <div className="card-elevated p-5">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add a product manually
          </h2>
          <p className="text-xs text-muted-foreground mb-4">
            If auto-detection missed some products, add them here so the AI can reference them when
            scoring competitor events.
          </p>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Product name <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="e.g. Anti-Aging Serum Pro"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Description
              </label>
              <Textarea
                placeholder="Brief description of what this product does..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Price
              </label>
              <Input
                placeholder="e.g. $29.99"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <Button
              onClick={() => addProduct.mutate()}
              disabled={!title.trim() || addProduct.isPending}
              size="sm"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              {addProduct.isPending ? "Adding..." : "Add Product"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
