"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Plus } from "lucide-react";

interface Competitor {
  name: string;
  domain: string;
  similarityScore: number;
  whySimilar: string;
  selected: boolean;
}

export default function CompetitorsSetupPage() {
  const router = useRouter();
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [customName, setCustomName] = useState("");
  const [customDomain, setCustomDomain] = useState("");

  useEffect(() => {
    fetch("/api/competitors", { method: "POST" })
      .then((r) => r.json())
      .then((data: Array<{ name: string; domain: string; similarityScore: number; whySimilar: string }>) => {
        setCompetitors(data.map((c) => ({ ...c, selected: true })));
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to discover competitors. Please try again.");
        setLoading(false);
      });
  }, []);

  const confirmMutation = useMutation({
    mutationFn: async (selected: Competitor[]) => {
      const res = await fetch("/api/competitors", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          selected.map(({ name, domain, similarityScore, whySimilar }) => ({
            name,
            domain,
            similarityScore,
            whySimilar,
          }))
        ),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: async () => {
      // Trigger all four modules in the background
      const modules = ["news", "product_launch", "review", "job_posting"];
      await Promise.all(
        modules.map((moduleType) =>
          fetch("/api/modules/trigger", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ moduleType }),
          })
        )
      );
      router.push("/monitoring");
    },
  });

  const addCustom = () => {
    const d = customDomain.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (!d || !customName.trim()) return;
    setCompetitors((prev) => [
      ...prev,
      {
        name: customName.trim(),
        domain: d,
        similarityScore: 70,
        whySimilar: "Manually added",
        selected: true,
      },
    ]);
    setCustomName("");
    setCustomDomain("");
  };

  const selected = competitors.filter((c) => c.selected);

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold mb-2">Review your competitors</h1>
      <p className="text-muted-foreground mb-8">
        We found these competitors. Uncheck any you don&apos;t want to track, or add your own.
      </p>

      {loading && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      )}

      {error && <p className="text-destructive text-sm">{error}</p>}

      {!loading && !error && (
        <div className="space-y-3">
          {competitors.map((c, i) => (
            <div
              key={c.domain}
              className={`border rounded-lg p-4 flex gap-4 items-start transition-opacity ${
                c.selected ? "" : "opacity-40"
              }`}
            >
              <Checkbox
                id={`comp-${i}`}
                checked={c.selected}
                onCheckedChange={(v) =>
                  setCompetitors((prev) =>
                    prev.map((x, j) =>
                      j === i ? { ...x, selected: !!v } : x
                    )
                  )
                }
                className="mt-1"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-sm text-muted-foreground">{c.domain}</span>
                  <Badge variant="secondary">{c.similarityScore}% match</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{c.whySimilar}</p>
              </div>
              <button
                onClick={() =>
                  setCompetitors((prev) => prev.filter((_, j) => j !== i))
                }
                className="text-muted-foreground hover:text-destructive"
                aria-label="Remove"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}

          <div className="border rounded-lg p-4 border-dashed">
            <p className="text-sm font-medium mb-3">Add a competitor manually</p>
            <div className="flex gap-2 flex-wrap">
              <Input
                placeholder="Company name"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="flex-1 min-w-36"
              />
              <Input
                placeholder="domain.com"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                className="flex-1 min-w-36"
              />
              <Button variant="outline" size="icon" onClick={addCustom}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="pt-4 flex items-center gap-4">
            <Button
              onClick={() => confirmMutation.mutate(selected)}
              disabled={selected.length === 0 || confirmMutation.isPending}
            >
              {confirmMutation.isPending
                ? "Starting monitoring…"
                : `Monitor ${selected.length} competitor${selected.length !== 1 ? "s" : ""} →`}
            </Button>
            {confirmMutation.isError && (
              <p className="text-destructive text-sm">Failed. Try again.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
