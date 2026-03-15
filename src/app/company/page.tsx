"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Globe,
  Users,
  Target,
  MapPin,
  Heart,
  Sparkles,
  Pencil,
  ShoppingBag,
  Newspaper,
  Briefcase,
  Search,
  Info,
} from "lucide-react";

interface Company {
  id: string;
  domain: string;
  name: string;
  description: string;
  industry: string;
  targetCustomer: { ageRange: string; geography: string; traits: string[] };
  whyCustomersBuy: string;
  confirmed: boolean;
  createdAt: string;
}

export default function CompanyPage() {
  const router = useRouter();

  const { data: company, isLoading } = useQuery<Company | null>({
    queryKey: ["company"],
    queryFn: () => fetch("/api/company").then((r) => r.json()),
  });

  const { data: competitors } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["competitors"],
    queryFn: () => fetch("/api/competitors").then((r) => r.json()),
  });

  if (isLoading) {
    return (
      <div className="ml-[240px]">
        <div className="max-w-3xl mx-auto px-6 py-10">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-4 w-96 mb-8" />
          <div className="space-y-4">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="ml-[240px]">
        <div className="max-w-3xl mx-auto px-6 py-10">
          <div className="card-elevated p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Building2 className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-lg font-semibold mb-2">No company profile yet</p>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
              Set up your company so we can start finding competitors and scoring events relevant to your business.
            </p>
            <Button onClick={() => router.push("/setup/company")}>Set up company</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ml-[240px]">
      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="page-header">
          <div className="flex items-start justify-between">
            <div>
              <h1>Company Profile</h1>
              <p>
                This is the AI-generated profile of your company. All competitive signals are scored
                and ranked based on this information — the more accurate it is, the better your results.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="flex-shrink-0 ml-4"
              onClick={() => router.push("/setup/company")}
            >
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Edit profile
            </Button>
          </div>
        </div>

        {/* How this profile is used */}
        <div className="card-elevated p-5 mb-6 bg-primary/5 border-primary/15">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-semibold mb-1">How this profile powers your intelligence</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Every time a competitive event is detected — a new product launch, a news article, a job posting, or a
                web mention — our AI reads it alongside your company profile. It evaluates how much the event could
                impact your specific market, customer base, and value proposition, then assigns a relevance score from 0 to 100.
                A more detailed profile leads to more precise scoring.
              </p>
            </div>
          </div>
        </div>

        {/* Company identity card */}
        <div className="card-elevated p-6 mb-4 animate-fade-in">
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="h-4 w-4 text-primary" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Company identity</h2>
          </div>
          <p className="text-[11px] text-muted-foreground mb-5">
            Core information about your business used to identify your competitive landscape.
          </p>

          <div className="space-y-5">
            {/* Name + domain */}
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 flex-shrink-0">
                <Globe className="h-6 w-6 text-indigo-500" />
              </div>
              <div>
                <h3 className="text-xl font-bold">{company.name}</h3>
                <p className="text-sm text-muted-foreground">{company.domain}</p>
              </div>
            </div>

            {/* Industry */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Industry</label>
              <div className="inline-flex items-center gap-2 bg-muted/60 rounded-lg px-3 py-1.5">
                <Target className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm font-medium">{company.industry}</span>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
                AI-Generated Description
              </label>
              <p className="text-sm leading-relaxed bg-muted/30 rounded-lg p-3 border border-border/40">
                {company.description}
              </p>
            </div>
          </div>
        </div>

        {/* Target customer card */}
        <div className="card-elevated p-6 mb-4 animate-fade-in animate-fade-in-delay-1">
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-4 w-4 text-primary" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Target customer</h2>
          </div>
          <p className="text-[11px] text-muted-foreground mb-5">
            Defines who your customers are. This is critical for scoring — events that could affect this
            specific audience are ranked higher.
          </p>

          <div className="grid grid-cols-2 gap-4 mb-5">
            <div className="bg-muted/30 rounded-lg p-4 border border-border/40">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Age range</label>
              </div>
              <p className="text-sm font-medium">{company.targetCustomer.ageRange || "Not specified"}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-4 border border-border/40">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Geography</label>
              </div>
              <p className="text-sm font-medium">{company.targetCustomer.geography || "Not specified"}</p>
            </div>
          </div>

          {/* Traits */}
          <div className="mb-5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">
              Customer personality traits
            </label>
            <p className="text-[11px] text-muted-foreground mb-2">
              Key characteristics of your ideal buyer. Used to evaluate whether competitor actions target the same audience.
            </p>
            {company.targetCustomer.traits.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {company.targetCustomer.traits.map((trait) => (
                  <span
                    key={trait}
                    className="inline-flex items-center gap-1 bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-medium"
                  >
                    {trait}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No traits specified</p>
            )}
          </div>

          {/* Why customers buy */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
              Why customers buy from you
            </label>
            <p className="text-[11px] text-muted-foreground mb-2">
              Your key value proposition. The AI uses this to detect when competitors threaten your strengths or imitate
              your differentiators.
            </p>
            <div className="bg-muted/30 rounded-lg p-3 border border-border/40 flex items-start gap-2">
              <Heart className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
              <p className="text-sm leading-relaxed">{company.whyCustomersBuy || "Not specified"}</p>
            </div>
          </div>
        </div>

        {/* What's being monitored */}
        <div className="card-elevated p-6 mb-4 animate-fade-in animate-fade-in-delay-2">
          <div className="flex items-center gap-2 mb-1">
            <Info className="h-4 w-4 text-primary" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active monitoring</h2>
          </div>
          <p className="text-[11px] text-muted-foreground mb-5">
            Based on your profile, these modules are running daily for each of your {competitors?.length ?? 0} tracked competitor{(competitors?.length ?? 0) !== 1 ? "s" : ""}.
          </p>

          <div className="grid grid-cols-2 gap-3">
            {[
              {
                icon: Newspaper,
                label: "News & Press",
                desc: "Media articles, press releases, and industry coverage that mention your competitors",
                color: "text-blue-600",
                bg: "bg-blue-50 border-blue-100",
              },
              {
                icon: ShoppingBag,
                label: "Product Launches",
                desc: "New products, pricing changes, and catalog updates compared to your offerings",
                color: "text-purple-600",
                bg: "bg-purple-50 border-purple-100",
              },
              {
                icon: Search,
                label: "Web Mentions",
                desc: "Brand mentions, reviews, and online discussions about competitor products",
                color: "text-amber-600",
                bg: "bg-amber-50 border-amber-100",
              },
              {
                icon: Briefcase,
                label: "Job Postings",
                desc: "Open roles that reveal strategic priorities, expansion plans, and team investment",
                color: "text-emerald-600",
                bg: "bg-emerald-50 border-emerald-100",
              },
            ].map((mod) => (
              <div key={mod.label} className={`rounded-xl border p-4 ${mod.bg}`}>
                <div className="flex items-center gap-2 mb-2">
                  <mod.icon className={`h-4 w-4 ${mod.color}`} />
                  <span className={`text-sm font-semibold ${mod.color}`}>{mod.label}</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{mod.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Scoring explanation */}
        <div className="card-elevated p-6 animate-fade-in animate-fade-in-delay-3">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">How scoring works</h2>
          </div>
          <p className="text-[11px] text-muted-foreground mb-5">
            Every competitive event receives a final relevance score (0-100) calculated from three factors.
          </p>

          <div className="space-y-3">
            {[
              {
                weight: "50%",
                label: "Signal strength",
                desc: "How significant is this event? A major product launch scores higher than a minor blog mention. Determined by AI analysis.",
              },
              {
                weight: "30%",
                label: "Recency",
                desc: "How recent is the event? Events from the past week score highest. Older events gradually lose relevance. Events over 90 days old are filtered out.",
              },
              {
                weight: "20%",
                label: "Sentiment",
                desc: "Is the event positive, neutral, or negative for the competitor? Positive competitor moves may represent threats to your market share.",
              },
            ].map((factor) => (
              <div key={factor.label} className="flex items-start gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold flex-shrink-0">
                  {factor.weight}
                </span>
                <div>
                  <p className="text-sm font-semibold">{factor.label}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{factor.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t mt-5 pt-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              The final score combines these three factors. Events scoring <strong>80+</strong> are flagged as critical,
              <strong> 60-79</strong> as important, <strong>40-59</strong> as notable, and below <strong>40</strong> as low priority.
              Events flagged as noise by the AI are automatically hidden from your feed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
