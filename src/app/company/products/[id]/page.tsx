"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ProductComparisonDialog } from "@/components/ProductComparisonDialog";
import { EventCard } from "@/components/EventCard";
import {
  ShoppingBag,
  ArrowLeft,
  Pencil,
  Trash2,
  Tag,
  Calendar,
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

interface EventRow {
  event: {
    id: string;
    title: string;
    sourceUrl: string;
    moduleType: string;
    eventOccurredAt: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rawData: any;
  };
  score: {
    finalScore: number;
    signalStrength: number;
    signalReasoning: string;
    sentimentLabel: string;
    summary: string;
    matchedProducts: string[] | null;
  };
  competitor: {
    id: string;
    name: string;
    domain: string;
  };
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editProductType, setEditProductType] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [comparisonDialog, setComparisonDialog] = useState<EventRow | null>(null);

  const { data: product, isLoading } = useQuery<CompanyProduct>({
    queryKey: ["companyProduct", id],
    queryFn: () => fetch(`/api/company/products/${id}`).then((r) => r.json()),
  });

  const { data: relatedEvents, isLoading: eventsLoading } = useQuery<EventRow[]>({
    queryKey: ["companyProductEvents", id],
    queryFn: () => fetch(`/api/company/products/${id}/events`).then((r) => r.json()),
    enabled: !!product,
  });

  const updateProduct = useMutation({
    mutationFn: async (data: {
      title: string;
      description: string;
      price: string;
      productType: string;
      imageUrl: string;
    }) => {
      const res = await fetch(`/api/company/products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.title,
          description: data.description || undefined,
          price: data.price || undefined,
          productType: data.productType || undefined,
          imageUrl: data.imageUrl || undefined,
        }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companyProduct", id] });
      queryClient.invalidateQueries({ queryKey: ["companyProducts"] });
      setEditing(false);
    },
  });

  const deleteProduct = useMutation({
    mutationFn: async () => {
      await fetch(`/api/company/products/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companyProducts"] });
      router.push("/company/products");
    },
  });

  const startEditing = () => {
    if (!product) return;
    setEditTitle(product.title);
    setEditDescription(product.description ?? "");
    setEditPrice(product.price ?? "");
    setEditProductType(product.productType ?? "");
    setEditImageUrl(product.imageUrl ?? "");
    setEditing(true);
  };

  if (isLoading) {
    return (
      <div className="ml-[240px]">
        <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="ml-[240px]">
        <div className="max-w-4xl mx-auto px-6 py-10">
          <div className="card-elevated p-10 text-center">
            <p className="text-lg font-semibold mb-2">Product not found</p>
            <p className="text-sm text-muted-foreground mb-4">
              This product may have been deleted.
            </p>
            <Button variant="outline" onClick={() => router.push("/company/products")}>
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
              Back to catalog
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ml-[240px]">
      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="page-header">
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => router.push("/company/products")}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="h-3 w-3" />
              Your Products
            </button>
            <span className="text-xs text-muted-foreground">/</span>
            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
              {product.title}
            </span>
          </div>
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-xl">{product.title}</h1>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button variant="outline" size="sm" onClick={startEditing}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Delete
              </Button>
            </div>
          </div>
        </div>

        {/* Product details */}
        {editing ? (
          <div className="card-elevated p-5 space-y-4 mb-8">
            <h2 className="text-sm font-semibold">Edit Product</h2>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Product name <span className="text-destructive">*</span>
              </label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Description
              </label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Price
                </label>
                <Input
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  placeholder="e.g. $29.99"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Product type
                </label>
                <Input
                  value={editProductType}
                  onChange={(e) => setEditProductType(e.target.value)}
                  placeholder="e.g. Serum"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Image URL
              </label>
              <Input
                value={editImageUrl}
                onChange={(e) => setEditImageUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Button
                size="sm"
                onClick={() =>
                  updateProduct.mutate({
                    title: editTitle.trim(),
                    description: editDescription.trim(),
                    price: editPrice.trim(),
                    productType: editProductType.trim(),
                    imageUrl: editImageUrl.trim(),
                  })
                }
                disabled={!editTitle.trim() || updateProduct.isPending}
              >
                {updateProduct.isPending ? "Saving..." : "Save changes"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="card-elevated p-5 mb-8">
            <div className="flex items-start gap-6">
              {product.imageUrl ? (
                <div className="w-32 h-32 rounded-lg overflow-hidden bg-muted border border-border/60 flex-shrink-0">
                  <img
                    src={product.imageUrl}
                    alt={product.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-32 h-32 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <ShoppingBag className="h-10 w-10 text-muted-foreground/40" />
                </div>
              )}
              <div className="flex-1 min-w-0 space-y-2">
                <h2 className="text-lg font-semibold">{product.title}</h2>
                {product.price && (
                  <p className="text-base font-medium">{product.price}</p>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  {product.productType && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <Tag className="h-3 w-3" />
                      {product.productType}
                    </Badge>
                  )}
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      product.sourceType === "auto"
                        ? "bg-blue-50 text-blue-700 border-blue-200"
                        : "bg-purple-50 text-purple-700 border-purple-200"
                    }`}
                  >
                    {product.sourceType === "auto" ? "Auto-detected" : "Manually added"}
                  </Badge>
                </div>
                {product.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {product.description}
                  </p>
                )}
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Added {new Date(product.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Related competitor events */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Competitor Events Affecting This Product
            {relatedEvents && relatedEvents.length > 0 && (
              <span className="ml-1">({relatedEvents.length})</span>
            )}
          </h2>

          {eventsLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="card-elevated p-4">
                  <div className="flex gap-4">
                    <Skeleton className="w-1 h-16 rounded-full flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3 w-32" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                    <Skeleton className="h-8 w-10 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : !relatedEvents || relatedEvents.length === 0 ? (
            <div className="card-elevated p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No competitor events have been linked to this product yet.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {relatedEvents.map((row) => (
                <EventCard
                  key={row.event.id}
                  row={row}
                  onClick={() => setComparisonDialog(row)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Delete confirmation dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete product?</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete &ldquo;{product.title}&rdquo;? This
                action cannot be undone. Previously matched competitor events will no
                longer reference this product.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-end gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteProduct.mutate()}
                disabled={deleteProduct.isPending}
              >
                {deleteProduct.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Product comparison dialog */}
        {comparisonDialog && (
          <ProductComparisonDialog
            open={!!comparisonDialog}
            onOpenChange={(open) => !open && setComparisonDialog(null)}
            matchedProductName={product.title}
            companyProduct={{
              title: product.title,
              description: product.description,
              price: product.price,
              imageUrl: product.imageUrl,
              productType: product.productType,
            }}
            companyProductId={product.id}
            eventTitle={comparisonDialog.event.title}
            moduleType={comparisonDialog.event.moduleType}
            competitorName={comparisonDialog.competitor.name}
            rawData={comparisonDialog.event.rawData}
            summary={comparisonDialog.score.summary}
            signalReasoning={comparisonDialog.score.signalReasoning}
            sentimentLabel={comparisonDialog.score.sentimentLabel}
            finalScore={comparisonDialog.score.finalScore}
            sourceUrl={comparisonDialog.event.sourceUrl}
          />
        )}
      </div>
    </div>
  );
}
