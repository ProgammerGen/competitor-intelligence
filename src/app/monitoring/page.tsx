"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, XCircle, Loader2, Play, Trash2, Plus } from "lucide-react";

type ModuleStatus = {
  id: string;
  moduleType: string;
  status: "running" | "success" | "error";
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
} | null;

type StatusRow = {
  competitor: { id: string; name: string; domain: string };
  modules: {
    news: ModuleStatus;
    product_launch: ModuleStatus;
    review: ModuleStatus;
    job_posting: ModuleStatus;
  };
};

const MODULE_LABELS: Record<string, string> = {
  news: "News",
  product_launch: "Products",
  review: "Web Search",
  job_posting: "Jobs",
};

function StatusIcon({ status }: { status: string | null }) {
  if (!status) return <span className="text-muted-foreground text-xs">—</span>;
  if (status === "running")
    return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
  if (status === "success")
    return <CheckCircle2 className="w-4 h-4 text-green-500" />;
  return <XCircle className="w-4 h-4 text-destructive" />;
}

function timeAgo(date: string) {
  const diff = (Date.now() - new Date(date).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function MonitoringPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [addDomain, setAddDomain] = useState("");

  const { data, isLoading } = useQuery<StatusRow[]>({
    queryKey: ["module-status"],
    queryFn: () => fetch("/api/modules/status").then((r) => r.json()),
    refetchInterval: 5000,
  });

  const triggerMutation = useMutation({
    mutationFn: ({
      moduleType,
      competitorId,
    }: {
      moduleType: string;
      competitorId?: string;
    }) =>
      fetch("/api/modules/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleType, competitorId }),
      }),
    onSuccess: () => {
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["module-status"] }), 500);
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/competitors/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      setConfirmDelete(null);
      queryClient.invalidateQueries({ queryKey: ["module-status"] });
    },
  });

  const addMutation = useMutation({
    mutationFn: async ({ name, domain }: { name: string; domain: string }) => {
      const res = await fetch("/api/competitors", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([{ name, domain, similarityScore: 70, whySimilar: "Manually added" }]),
      });
      if (!res.ok) throw new Error("Failed to add");
      return res.json() as Promise<Array<{ id: string }>>;
    },
    onSuccess: async (inserted) => {
      setAddName("");
      setAddDomain("");
      setShowAdd(false);
      queryClient.invalidateQueries({ queryKey: ["module-status"] });
      if (inserted[0]?.id) {
        await Promise.all(
          Object.keys(MODULE_LABELS).map((moduleType) =>
            fetch("/api/modules/trigger", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ moduleType, competitorId: inserted[0].id }),
            })
          )
        );
        setTimeout(() => queryClient.invalidateQueries({ queryKey: ["module-status"] }), 500);
      }
    },
  });

  const changeCompanyMutation = useMutation({
    mutationFn: () => fetch("/api/company", { method: "DELETE" }),
    onSuccess: () => router.push("/setup/company"),
  });

  const handleAdd = () => {
    const d = addDomain.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (!d || !addName.trim()) return;
    addMutation.mutate({ name: addName.trim(), domain: d });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Monitoring</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Module status per competitor. Auto-refreshes every 5s.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => changeCompanyMutation.mutate()}
            disabled={changeCompanyMutation.isPending}
          >
            {changeCompanyMutation.isPending ? "Resetting…" : "Change company"}
          </Button>
          <Link href="/feed">
            <Button variant="outline">View feed →</Button>
          </Link>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      )}

      {data?.length === 0 && (
        <p className="text-muted-foreground text-sm">No competitors configured yet.</p>
      )}

      <div className="space-y-4">
        {data?.map((row) => (
          <div key={row.competitor.id} className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="font-medium">{row.competitor.name}</span>
                <span className="text-sm text-muted-foreground ml-2">
                  {row.competitor.domain}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {confirmDelete === row.competitor.id ? (
                  <>
                    <span className="text-xs text-muted-foreground">Remove and delete all data?</span>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={removeMutation.isPending}
                      onClick={() => removeMutation.mutate(row.competitor.id)}
                    >
                      {removeMutation.isPending ? "Removing…" : "Confirm"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setConfirmDelete(row.competitor.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={triggerMutation.isPending}
                      onClick={() =>
                        Promise.all(
                          Object.keys(MODULE_LABELS).map((moduleType) =>
                            triggerMutation.mutate({
                              moduleType,
                              competitorId: row.competitor.id,
                            })
                          )
                        )
                      }
                    >
                      <Play className="w-3 h-3 mr-1" />
                      Run all
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              {(Object.entries(MODULE_LABELS) as [keyof typeof row.modules, string][]).map(
                ([key, label]) => {
                  const mod = row.modules[key];
                  return (
                    <div
                      key={key}
                      className="bg-muted/40 rounded p-3 flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">{label}</span>
                        <StatusIcon status={mod?.status ?? null} />
                      </div>
                      {mod?.completedAt && (
                        <span className="text-xs text-muted-foreground">
                          {timeAgo(mod.completedAt)}
                        </span>
                      )}
                      {mod?.status === "error" && (
                        <span className="text-xs text-destructive truncate" title={mod.errorMessage ?? ""}>
                          {mod.errorMessage?.slice(0, 40)}
                        </span>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-xs p-1"
                        disabled={triggerMutation.isPending}
                        onClick={() =>
                          triggerMutation.mutate({
                            moduleType: key,
                            competitorId: row.competitor.id,
                          })
                        }
                      >
                        Run now
                      </Button>
                    </div>
                  );
                }
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 border rounded-lg p-4 border-dashed">
        {showAdd ? (
          <div>
            <p className="text-sm font-medium mb-3">Add a competitor</p>
            <div className="flex gap-2 flex-wrap">
              <Input
                placeholder="Company name"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                className="flex-1 min-w-36"
              />
              <Input
                placeholder="domain.com"
                value={addDomain}
                onChange={(e) => setAddDomain(e.target.value)}
                className="flex-1 min-w-36"
              />
              <Button variant="outline" size="icon" onClick={handleAdd} disabled={addMutation.isPending}>
                {addMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)}>
                Cancel
              </Button>
            </div>
            {addMutation.isError && (
              <p className="text-destructive text-xs mt-2">Failed to add competitor.</p>
            )}
          </div>
        ) : (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-full"
          >
            <Plus className="w-4 h-4" />
            Add competitor
          </button>
        )}
      </div>
    </div>
  );
}
