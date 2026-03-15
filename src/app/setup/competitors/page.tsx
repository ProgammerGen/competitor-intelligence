"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  X,
  Plus,
  ArrowRight,
  Globe,
  Radar,
  Sparkles,
  Newspaper,
  ShoppingBag,
  Briefcase,
  Search,
  Shield,
  Check,
} from "lucide-react";

const DISCOVERY_STEPS = [
  { text: "Reading your company profile...", delay: 0 },
  { text: "Analyzing your industry landscape...", delay: 2500 },
  { text: "Identifying overlapping markets...", delay: 5000 },
  { text: "Evaluating product similarities...", delay: 8000 },
  { text: "Scoring competitor relevance...", delay: 11000 },
  { text: "Finalizing results...", delay: 14000 },
];

function DiscoveryLoader() {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const timers = DISCOVERY_STEPS.map((step, i) =>
      setTimeout(() => setActiveStep(i), step.delay)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="card-elevated p-8 text-center animate-fade-in">
      {/* Pulsing AI icon */}
      <div className="relative mx-auto mb-6 w-16 h-16">
        <div className="absolute inset-0 rounded-2xl bg-primary/20 animate-ping" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-violet-600">
          <Search className="h-7 w-7 text-white" />
        </div>
      </div>

      <h3 className="text-lg font-bold mb-1">Discovering your competitors</h3>
      <p className="text-sm text-muted-foreground mb-8">
        AI is searching for businesses that compete in your space
      </p>

      {/* Animated steps */}
      <div className="max-w-xs mx-auto space-y-3 text-left">
        {DISCOVERY_STEPS.map((step, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 transition-all duration-500 ${
              i <= activeStep ? "opacity-100" : "opacity-0 translate-y-2"
            }`}
          >
            {i < activeStep ? (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100">
                <Check className="h-3 w-3 text-emerald-600" />
              </span>
            ) : i === activeStep ? (
              <span className="relative flex h-5 w-5 items-center justify-center">
                <span className="absolute h-5 w-5 rounded-full bg-primary/20 animate-ping" />
                <span className="h-2.5 w-2.5 rounded-full bg-primary" />
              </span>
            ) : (
              <span className="flex h-5 w-5 items-center justify-center">
                <span className="h-2 w-2 rounded-full bg-muted" />
              </span>
            )}
            <span
              className={`text-sm ${
                i < activeStep
                  ? "text-muted-foreground line-through"
                  : i === activeStep
                  ? "text-foreground font-medium"
                  : "text-muted-foreground"
              }`}
            >
              {step.text}
            </span>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground mt-8">This usually takes 15–20 seconds</p>
    </div>
  );
}

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

  function matchColor(score: number) {
    if (score >= 85) return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (score >= 70) return "bg-blue-50 text-blue-700 border-blue-200";
    return "bg-slate-50 text-slate-600 border-slate-200";
  }

  function matchLabel(score: number) {
    if (score >= 85) return "Very similar";
    if (score >= 70) return "Similar";
    return "Somewhat similar";
  }

  return (
    <div className="min-h-screen flex items-start justify-center px-4 py-12 bg-background">
      <div className="w-full max-w-xl">
        {/* Brand header */}
        <div className="flex items-center gap-2.5 mb-8">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
            <Radar className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <span className="text-base font-bold">Competitor Intelligence</span>
            <p className="text-[11px] text-muted-foreground leading-tight">Set up your workspace</p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-3 mb-10">
          {/* Step 1: Your company */}
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white text-xs font-bold">
              &#10003;
            </span>
            <span className="text-sm text-muted-foreground">Your company</span>
          </div>
          <div className="flex-1 h-px bg-primary" />
          {/* Step 2: AI Analysis */}
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white text-xs font-bold">
              &#10003;
            </span>
            <span className="text-sm text-muted-foreground">AI Analysis</span>
          </div>
          <div className="flex-1 h-px bg-primary" />
          {/* Step 3: Competitors */}
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
              3
            </span>
            <span className="text-sm font-semibold">Competitors</span>
          </div>
        </div>

        {/* Header */}
        <div className="page-header mb-4">
          <h1>Choose your competitors</h1>
          <p>
            Based on your company profile, our AI has identified businesses that compete in your space.
            Select the ones you want to monitor — you can always add or remove competitors later.
          </p>
        </div>

        {/* Loading */}
        {loading && !error && <DiscoveryLoader />}

        {error && (
          <div className="card-elevated p-5 border-red-200 bg-red-50">
            <p className="text-destructive text-sm font-medium">Competitor discovery failed</p>
            <p className="text-destructive/70 text-xs mt-1">
              We couldn&apos;t discover competitors automatically. You can add them manually below, or refresh the page to try again.
            </p>
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-3">
            {/* Understanding scores */}
            <div className="card-elevated p-4 mb-2">
              <div className="flex items-start gap-2">
                <Search className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold mb-1">About similarity scores</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Each competitor is assigned a <strong>similarity score</strong> (0-100%) based on how closely they
                    match your industry, target audience, and product offerings. Higher scores indicate a more direct competitor.
                    You can uncheck any company you don&apos;t consider a competitor, or remove them entirely.
                  </p>
                </div>
              </div>
            </div>

            {/* Competitor list */}
            {competitors.map((c, i) => (
              <div
                key={c.domain}
                className={`card-elevated p-4 flex gap-4 items-start transition-all duration-200 animate-fade-in ${
                  c.selected ? "" : "opacity-40 scale-[0.99]"
                } ${i < 5 ? `animate-fade-in-delay-${i}` : ""}`}
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
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted">
                      <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div>
                      <span className="font-semibold text-sm block leading-tight">{c.name}</span>
                      <span className="text-[11px] text-muted-foreground">{c.domain}</span>
                    </div>
                    <Badge className={`text-[11px] border ${matchColor(c.similarityScore)}`} variant="outline">
                      {c.similarityScore}% &middot; {matchLabel(c.similarityScore)}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                    <span className="text-xs font-medium text-foreground">Why similar: </span>
                    {c.whySimilar}
                  </p>
                </div>
                <button
                  onClick={() =>
                    setCompetitors((prev) => prev.filter((_, j) => j !== i))
                  }
                  className="text-muted-foreground hover:text-destructive transition-colors p-1"
                  aria-label="Remove competitor"
                  title="Remove from list"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}

            {/* Add manually */}
            <div className="card-elevated p-5 border-dashed">
              <p className="text-sm font-semibold mb-1">Add a competitor manually</p>
              <p className="text-xs text-muted-foreground mb-3">
                Know a competitor that wasn&apos;t discovered? Add them here with their company name and website domain.
              </p>
              <div className="flex gap-2 flex-wrap">
                <Input
                  placeholder="Company name (e.g. Acme Corp)"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="flex-1 min-w-36"
                />
                <Input
                  placeholder="Domain (e.g. acme.com)"
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value)}
                  className="flex-1 min-w-36"
                />
                <Button variant="outline" size="icon" onClick={addCustom} title="Add competitor">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* What will be monitored */}
            <div className="card-elevated p-5 bg-muted/30">
              <h3 className="text-sm font-semibold mb-3">What gets monitored for each competitor</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Once you confirm, these four intelligence modules will start collecting data for every selected competitor:
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: Newspaper, label: "News & Press", desc: "Media articles, press releases, and industry coverage" },
                  { icon: ShoppingBag, label: "Products & Pricing", desc: "New product launches, pricing changes, and catalog updates" },
                  { icon: Globe, label: "Web Mentions", desc: "Brand mentions, reviews, and online discussions" },
                  { icon: Briefcase, label: "Job Postings", desc: "Open roles revealing strategic priorities and growth areas" },
                ].map((item) => (
                  <div key={item.label} className="flex items-start gap-2.5">
                    <item.icon className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium">{item.label}</p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Confirm */}
            <div className="pt-4 flex flex-col gap-3">
              <div className="flex items-center gap-4">
                <Button
                  onClick={() => confirmMutation.mutate(selected)}
                  disabled={selected.length === 0 || confirmMutation.isPending}
                  className="px-6"
                >
                  {confirmMutation.isPending ? (
                    <>
                      <Sparkles className="h-4 w-4 mr-2 animate-pulse" />
                      Starting monitoring...
                    </>
                  ) : (
                    <>
                      Start monitoring {selected.length} competitor{selected.length !== 1 ? "s" : ""}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
                {confirmMutation.isError && (
                  <p className="text-destructive text-sm">Failed to start monitoring. Please try again.</p>
                )}
              </div>
              {selected.length === 0 && (
                <p className="text-xs text-amber-600">
                  Select at least one competitor to continue. You can always add more later from the Monitoring dashboard.
                </p>
              )}

              {/* Privacy note */}
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <Shield className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <p>Data is collected from public sources only. You can remove any competitor and delete all its data at any time.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
