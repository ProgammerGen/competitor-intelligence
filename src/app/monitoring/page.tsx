"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Play,
  Trash2,
  Plus,
  RotateCw,
  Globe,
  Newspaper,
  ShoppingBag,
  Briefcase,
  Info,
  ArrowUpRight,
  Clock,
  AlertTriangle,
  Zap,
  Sparkles,
} from "lucide-react";

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

const MODULE_META: Record<
  string,
  {
    label: string;
    color: string;
    bg: string;
    icon: typeof Newspaper;
    description: string;
    detail: string;
  }
> = {
  news: {
    label: "News",
    color: "text-blue-600",
    bg: "bg-blue-50 border-blue-100",
    icon: Newspaper,
    description: "Press & media",
    detail: "Scans news sources for articles mentioning this competitor. Detects press releases, media coverage, and industry mentions.",
  },
  product_launch: {
    label: "Products",
    color: "text-purple-600",
    bg: "bg-purple-50 border-purple-100",
    icon: ShoppingBag,
    description: "Product changes",
    detail: "Monitors the competitor's product catalog for new launches, price changes, and discontinued items.",
  },
  review: {
    label: "Web Search",
    color: "text-amber-600",
    bg: "bg-amber-50 border-amber-100",
    icon: Globe,
    description: "Web mentions",
    detail: "Searches the web for brand mentions, reviews, and discussions about this competitor.",
  },
  job_posting: {
    label: "Jobs",
    color: "text-emerald-600",
    bg: "bg-emerald-50 border-emerald-100",
    icon: Briefcase,
    description: "Hiring signals",
    detail: "Tracks job postings to reveal strategic priorities, expansion plans, and team growth.",
  },
};

function StatusIcon({ status }: { status: string | null }) {
  if (!status)
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100" title="Not yet run">
        <span className="h-2 w-2 rounded-full bg-slate-300" />
      </span>
    );
  if (status === "running")
    return (
      <span className="relative flex h-5 w-5 items-center justify-center" title="Running now">
        <span className="absolute h-5 w-5 rounded-full bg-blue-100 animate-ping opacity-30" />
        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
      </span>
    );
  if (status === "success")
    return (
      <span title="Last run succeeded">
        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
      </span>
    );
  return (
    <span title="Last run failed">
      <XCircle className="h-5 w-5 text-red-500" />
    </span>
  );
}

function StatusLabel({ status }: { status: string | null }) {
  if (!status) return <span className="text-[11px] text-slate-400">Waiting for first run</span>;
  if (status === "running") return <span className="text-[11px] text-blue-600 font-medium">Collecting data...</span>;
  if (status === "success") return <span className="text-[11px] text-emerald-600">Completed successfully</span>;
  return <span className="text-[11px] text-red-600">Failed — see error below</span>;
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
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const competitorRefs = useRef<Map<string, HTMLDivElement>>(new Map());

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
      // Get AI similarity score
      let similarityScore = 50;
      let whySimilar = "Manually added";
      try {
        const scoreRes = await fetch("/api/competitors/score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, domain }),
        });
        if (scoreRes.ok) {
          const score = await scoreRes.json();
          similarityScore = score.similarityScore;
          whySimilar = score.whySimilar;
        }
      } catch {
        // Fallback to defaults above
      }

      const res = await fetch("/api/competitors", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([{ name, domain, similarityScore, whySimilar }]),
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
        setLastAddedId(inserted[0].id);
        await Promise.all(
          Object.keys(MODULE_META).map((moduleType) =>
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

  // Auto-scroll to newly added competitor
  useEffect(() => {
    if (lastAddedId && data?.some((row) => row.competitor.id === lastAddedId)) {
      setTimeout(() => {
        competitorRefs.current.get(lastAddedId)?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
        setLastAddedId(null);
      }, 200);
    }
  }, [data, lastAddedId]);

  const changeCompanyMutation = useMutation({
    mutationFn: () => fetch("/api/company", { method: "DELETE" }),
    onSuccess: () => router.push("/setup/company"),
  });

  const handleAdd = () => {
    const d = addDomain.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (!d || !addName.trim()) return;
    addMutation.mutate({ name: addName.trim(), domain: d });
  };

  // Summary stats
  const totalCompetitors = data?.length ?? 0;
  const totalModules = totalCompetitors * 4;
  const runningCount = data?.reduce(
    (acc, row) =>
      acc + Object.values(row.modules).filter((m) => m?.status === "running").length,
    0
  ) ?? 0;
  const errorCount = data?.reduce(
    (acc, row) =>
      acc + Object.values(row.modules).filter((m) => m?.status === "error").length,
    0
  ) ?? 0;
  const successCount = data?.reduce(
    (acc, row) =>
      acc + Object.values(row.modules).filter((m) => m?.status === "success").length,
    0
  ) ?? 0;

  return (
    <div className="ml-[240px]">
      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="page-header">
          <div className="flex items-start justify-between">
            <div>
              <h1>Monitoring Dashboard</h1>
              <p className="max-w-xl">
                Track the status of all intelligence modules across your competitors. Each module runs automatically
                every day, or you can trigger a manual sync anytime.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-4">
              <Link href="/feed">
                <Button variant="outline" size="sm">
                  View feed
                  <ArrowUpRight className="h-3.5 w-3.5 ml-1.5" />
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive text-xs"
                onClick={() => changeCompanyMutation.mutate()}
                disabled={changeCompanyMutation.isPending}
              >
                <RotateCw className="h-3 w-3 mr-1.5" />
                {changeCompanyMutation.isPending ? "Resetting..." : "Reset company"}
              </Button>
            </div>
          </div>
        </div>

        {/* Summary stats */}
        {!isLoading && data && data.length > 0 && (
          <div className="grid grid-cols-4 gap-3 mb-6 animate-fade-in">
            <div className="card-elevated p-4">
              <div className="flex items-center gap-2 mb-1">
                <Globe className="h-4 w-4 text-indigo-500" />
                <span className="text-xs text-muted-foreground font-medium">Competitors</span>
              </div>
              <p className="text-xl font-bold">{totalCompetitors}</p>
              <p className="text-[11px] text-muted-foreground">being tracked</p>
            </div>
            <div className="card-elevated p-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="text-xs text-muted-foreground font-medium">Healthy</span>
              </div>
              <p className="text-xl font-bold text-emerald-600">{successCount}</p>
              <p className="text-[11px] text-muted-foreground">of {totalModules} modules OK</p>
            </div>
            <div className="card-elevated p-4">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="h-4 w-4 text-blue-500" />
                <span className="text-xs text-muted-foreground font-medium">Running</span>
              </div>
              <p className="text-xl font-bold text-blue-600">{runningCount}</p>
              <p className="text-[11px] text-muted-foreground">modules active now</p>
            </div>
            <div className="card-elevated p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span className="text-xs text-muted-foreground font-medium">Errors</span>
              </div>
              <p className="text-xl font-bold text-red-600">{errorCount}</p>
              <p className="text-[11px] text-muted-foreground">need attention</p>
            </div>
          </div>
        )}

        {/* Auto-refresh info */}
        {!isLoading && data && data.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-5">
            <Clock className="h-3.5 w-3.5" />
            <span>This page auto-refreshes every 5 seconds. Modules sync daily at 6:00 AM ET, or run them manually below.</span>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="space-y-4">
            <div className="card-elevated p-4">
              <p className="text-sm text-muted-foreground">Loading your monitoring dashboard...</p>
            </div>
            {[...Array(3)].map((_, i) => (
              <div key={i} className="card-elevated p-6">
                <Skeleton className="h-6 w-48 mb-4" />
                <div className="grid grid-cols-4 gap-3">
                  {[...Array(4)].map((_, j) => (
                    <Skeleton key={j} className="h-28 rounded-lg" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {data?.length === 0 && (
          <div className="card-elevated p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Globe className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-lg font-semibold mb-2">No competitors configured</p>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-4">
              Add your first competitor below to start monitoring their news, products, web presence, and hiring activity.
            </p>
          </div>
        )}

        {/* Competitor cards */}
        <div className="space-y-5">
          {data?.map((row, idx) => (
            <div
              key={row.competitor.id}
              ref={(el) => { if (el) competitorRefs.current.set(row.competitor.id, el); }}
              className={`card-elevated p-5 animate-fade-in ${
                idx < 5 ? `animate-fade-in-delay-${idx}` : ""
              }`}
            >
              {/* Competitor header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100">
                    <Globe className="h-5 w-5 text-indigo-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base">{row.competitor.name}</h3>
                    <span className="text-xs text-muted-foreground">{row.competitor.domain}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {confirmDelete === row.competitor.id ? (
                    <>
                      <span className="text-xs text-muted-foreground">
                        This will permanently remove all collected data for this competitor.
                      </span>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7 text-xs"
                        disabled={removeMutation.isPending}
                        onClick={() => removeMutation.mutate(row.competitor.id)}
                      >
                        {removeMutation.isPending ? "Removing..." : "Yes, remove"}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setConfirmDelete(null)}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => setConfirmDelete(row.competitor.id)}
                        title="Remove this competitor"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        disabled={triggerMutation.isPending}
                        onClick={() =>
                          Promise.all(
                            Object.keys(MODULE_META).map((moduleType) =>
                              triggerMutation.mutate({
                                moduleType,
                                competitorId: row.competitor.id,
                              })
                            )
                          )
                        }
                        title="Run all 4 modules for this competitor"
                      >
                        <Play className="h-3 w-3 mr-1.5" />
                        Run all modules
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Module grid */}
              <div className="grid grid-cols-4 gap-3">
                {(Object.entries(MODULE_META) as [keyof typeof row.modules, typeof MODULE_META[string]][]).map(
                  ([key, meta]) => {
                    const mod = row.modules[key];
                    const moduleKey = `${row.competitor.id}-${key}`;
                    const isExpanded = expandedModule === moduleKey;
                    const ModIcon = meta.icon;
                    return (
                      <div
                        key={key}
                        className={`rounded-xl border p-3.5 flex flex-col gap-2 transition-all ${meta.bg} ${
                          isExpanded ? "ring-2 ring-offset-1 ring-primary/20" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <ModIcon className={`h-3.5 w-3.5 ${meta.color}`} />
                            <span className={`text-xs font-semibold ${meta.color}`}>{meta.label}</span>
                          </div>
                          <StatusIcon status={mod?.status ?? null} />
                        </div>

                        {/* Short description */}
                        <p className="text-[11px] text-muted-foreground leading-snug">{meta.description}</p>

                        {/* Status text */}
                        <StatusLabel status={mod?.status ?? null} />

                        {mod?.completedAt && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            Last run: {timeAgo(mod.completedAt)}
                          </span>
                        )}

                        {mod?.status === "error" && (
                          <span className="text-[11px] text-red-600 leading-snug" title={mod.errorMessage ?? ""}>
                            {mod.errorMessage?.slice(0, 60)}
                          </span>
                        )}

                        <div className="flex items-center gap-1 mt-auto pt-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[11px] px-2"
                            disabled={triggerMutation.isPending}
                            onClick={() =>
                              triggerMutation.mutate({
                                moduleType: key,
                                competitorId: row.competitor.id,
                              })
                            }
                          >
                            <Play className="h-2.5 w-2.5 mr-1" />
                            Run now
                          </Button>
                          <button
                            className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                            onClick={() => setExpandedModule(isExpanded ? null : moduleKey)}
                          >
                            <Info className="h-3 w-3" />
                          </button>
                        </div>

                        {/* Expanded detail */}
                        {isExpanded && (
                          <div className="border-t pt-2 mt-1 animate-fade-in">
                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                              {meta.detail}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Add competitor */}
        <div className="mt-6 card-elevated p-5 border-dashed">
          {showAdd ? (
            <div>
              <p className="text-sm font-semibold mb-1">Add a competitor</p>
              <p className="text-xs text-muted-foreground mb-3">
                Enter the company name and website domain. All four intelligence modules will automatically start collecting data.
              </p>
              <div className="flex gap-2 flex-wrap">
                <Input
                  placeholder="Company name (e.g. Acme Corp)"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  className="flex-1 min-w-36"
                />
                <Input
                  placeholder="Domain (e.g. acme.com)"
                  value={addDomain}
                  onChange={(e) => setAddDomain(e.target.value)}
                  className="flex-1 min-w-36"
                />
                <Button variant="outline" size="icon" onClick={handleAdd} disabled={addMutation.isPending}>
                  {addMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)}>
                  Cancel
                </Button>
              </div>
              {addMutation.isPending && (
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground animate-fade-in">
                  <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" />
                  <span>AI is analyzing competitor similarity...</span>
                </div>
              )}
              {addMutation.isError && (
                <p className="text-destructive text-xs mt-2">Failed to add competitor. Please check the details and try again.</p>
              )}
            </div>
          ) : (
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
            >
              <Plus className="h-4 w-4" />
              <div className="text-left">
                <span className="font-medium block">Add competitor</span>
                <span className="text-xs">Start tracking a new competitor across all modules</span>
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
