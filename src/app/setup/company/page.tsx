"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowRight,
  Building2,
  Sparkles,
  Users,
  Radar,
  Newspaper,
  ShoppingBag,
  Globe,
  Briefcase,
  Shield,
  Pencil,
  Target,
  MapPin,
  Heart,
  Check,
} from "lucide-react";

const INDUSTRIES = [
  "E-commerce",
  "Beauty",
  "Apparel",
  "Health & Wellness",
  "Home & Living",
  "Food & Beverage",
  "Technology",
  "Sports & Outdoors",
  "Other",
];

interface Profile {
  name: string;
  description: string;
  industry: string;
  targetCustomer: { ageRange: string; geography: string; traits: string[] };
  whyCustomersBuy: string;
}

// Steps: "input" → "analyzing" → "review" → "edit"
type Step = "input" | "analyzing" | "review" | "edit";

const ANALYSIS_STEPS = [
  { text: "Visiting your website...", delay: 0 },
  { text: "Reading homepage content...", delay: 2000 },
  { text: "Identifying your industry...", delay: 4500 },
  { text: "Understanding your target customer...", delay: 7000 },
  { text: "Mapping your value proposition...", delay: 9500 },
  { text: "Building your company profile...", delay: 12000 },
];

function AnalyzingLoader({ domain }: { domain: string }) {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const timers = ANALYSIS_STEPS.map((step, i) =>
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
          <Sparkles className="h-7 w-7 text-white" />
        </div>
      </div>

      <h3 className="text-lg font-bold mb-1">AI is analyzing your company</h3>
      <p className="text-sm text-muted-foreground mb-8">
        Reading <span className="font-medium text-foreground">{domain}</span> and building your profile
      </p>

      {/* Animated steps */}
      <div className="max-w-xs mx-auto space-y-3 text-left">
        {ANALYSIS_STEPS.map((step, i) => (
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

      <p className="text-xs text-muted-foreground mt-8">This usually takes 10–15 seconds</p>
    </div>
  );
}

export default function CompanySetupPage() {
  const router = useRouter();
  const [domain, setDomain] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [step, setStep] = useState<Step>("input");

  const enrichMutation = useMutation({
    mutationFn: async (d: string) => {
      const res = await fetch("/api/company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: d }),
      });
      if (!res.ok) throw new Error("Enrichment failed");
      return res.json() as Promise<Profile>;
    },
    onSuccess: (data) => {
      setProfile(data);
      setStep("review");
    },
    onError: () => {
      setStep("input");
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async (p: Profile & { domain: string }) => {
      const res = await fetch("/api/company", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
      });
      if (!res.ok) throw new Error("Save failed");
      return res.json();
    },
    onSuccess: () => router.push("/setup/competitors"),
  });

  const handleEnrich = (e: React.FormEvent) => {
    e.preventDefault();
    const d = domain.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
    setStep("analyzing");
    enrichMutation.mutate(d);
  };

  const cleanDomain = domain.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");

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
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                step === "input" || step === "analyzing"
                  ? "bg-primary text-primary-foreground"
                  : "bg-emerald-500 text-white"
              }`}
            >
              {step === "review" || step === "edit" ? "✓" : "1"}
            </span>
            <span className={`text-sm ${step === "input" || step === "analyzing" ? "font-semibold" : "text-muted-foreground"}`}>
              Your company
            </span>
          </div>
          <div className={`flex-1 h-px ${step === "review" || step === "edit" ? "bg-primary" : "bg-border"}`} />
          {/* Step 2: AI Analysis */}
          <div className="flex items-center gap-2">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                step === "review" || step === "edit"
                  ? "bg-primary text-primary-foreground"
                  : step === "analyzing"
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              2
            </span>
            <span className={`text-sm ${step === "review" || step === "edit" ? "font-semibold" : step === "analyzing" ? "font-medium text-primary" : "text-muted-foreground"}`}>
              {step === "analyzing" ? "Analyzing..." : "AI Analysis"}
            </span>
          </div>
          <div className="flex-1 h-px bg-border" />
          {/* Step 3: Competitors */}
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs font-bold">
              3
            </span>
            <span className="text-sm text-muted-foreground">Competitors</span>
          </div>
        </div>

        {/* ============================================================ */}
        {/*  STEP 1: Domain input                                        */}
        {/* ============================================================ */}
        {step === "input" && (
          <>
            <div className="page-header mb-4">
              <h1>Tell us about your company</h1>
              <p>
                We&apos;ll use this information to find your competitors, score events by relevance to your
                business, and personalize your intelligence feed. The more detail you provide, the better your results.
              </p>
            </div>

            {/* How it works */}
            <div className="card-elevated p-5 mb-8">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                How it works
              </h3>
              <ol className="space-y-2.5 text-sm text-muted-foreground">
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold flex-shrink-0 mt-0.5">1</span>
                  <span>Enter your domain and our AI analyzes your website to build your company profile.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold flex-shrink-0 mt-0.5">2</span>
                  <span>Review the AI analysis and confirm or edit anything that looks off.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold flex-shrink-0 mt-0.5">3</span>
                  <span>We&apos;ll discover competitors and let you choose which ones to track.</span>
                </li>
              </ol>
            </div>

            {/* Domain form */}
            <form onSubmit={handleEnrich} className="card-elevated p-6">
              <Label className="text-sm font-medium mb-1 block">Company website</Label>
              <p className="text-xs text-muted-foreground mb-3">
                Enter the main domain of your company. We&apos;ll visit the homepage to understand what you do.
              </p>
              <div className="flex gap-3">
                <Input
                  placeholder="yourcompany.com"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  required
                  className="flex-1"
                />
                <Button type="submit" disabled={enrichMutation.isPending}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Analyze
                </Button>
              </div>
            </form>

            {enrichMutation.isError && (
              <div className="mt-4 card-elevated p-4 border-red-200 bg-red-50">
                <p className="text-destructive text-sm font-medium">Failed to analyze domain</p>
                <p className="text-destructive/70 text-xs mt-1">
                  Make sure the domain is correct and publicly accessible. Try entering just the domain without &quot;https://&quot;.
                </p>
              </div>
            )}
          </>
        )}

        {/* ============================================================ */}
        {/*  STEP 1b: AI Analyzing animation                             */}
        {/* ============================================================ */}
        {step === "analyzing" && <AnalyzingLoader domain={cleanDomain} />}

        {/* ============================================================ */}
        {/*  STEP 2: Review AI analysis (read-only)                      */}
        {/* ============================================================ */}
        {step === "review" && profile && (
          <div className="space-y-5 animate-fade-in">
            <div className="page-header mb-2">
              <h1>Here&apos;s what we found</h1>
              <p>
                Our AI analyzed <span className="font-medium text-foreground">{cleanDomain}</span> and
                built the following profile. Review the details below — if everything looks right, confirm to continue.
                If something is off, click &quot;Edit profile&quot; to make changes.
              </p>
            </div>

            {/* Company identity */}
            <div className="card-elevated p-6">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="h-4 w-4 text-primary" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Company identity</h2>
              </div>

              <div className="flex items-start gap-4 mb-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 flex-shrink-0">
                  <Globe className="h-6 w-6 text-indigo-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">{profile.name}</h3>
                  <p className="text-sm text-muted-foreground">{cleanDomain}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Industry</label>
                  <div className="inline-flex items-center gap-2 bg-muted/60 rounded-lg px-3 py-1.5">
                    <Target className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium">{profile.industry}</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
                    What your company does
                  </label>
                  <p className="text-sm leading-relaxed bg-muted/30 rounded-lg p-3 border border-border/40">
                    {profile.description}
                  </p>
                </div>
              </div>
            </div>

            {/* Target customer */}
            <div className="card-elevated p-6">
              <div className="flex items-center gap-2 mb-4">
                <Users className="h-4 w-4 text-primary" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Target customer</h2>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-muted/30 rounded-lg p-3 border border-border/40">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Users className="h-3 w-3 text-muted-foreground" />
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Age range</label>
                  </div>
                  <p className="text-sm font-medium">{profile.targetCustomer.ageRange || "Not detected"}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3 border border-border/40">
                  <div className="flex items-center gap-1.5 mb-1">
                    <MapPin className="h-3 w-3 text-muted-foreground" />
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Geography</label>
                  </div>
                  <p className="text-sm font-medium">{profile.targetCustomer.geography || "Not detected"}</p>
                </div>
              </div>

              {/* Traits */}
              <div className="mb-4">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-2">
                  Customer personality traits
                </label>
                {profile.targetCustomer.traits.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {profile.targetCustomer.traits.map((trait) => (
                      <span
                        key={trait}
                        className="inline-flex items-center gap-1 bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-medium"
                      >
                        {trait}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No traits detected</p>
                )}
              </div>

              {/* Why buy */}
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
                  Why customers buy from you
                </label>
                <div className="bg-muted/30 rounded-lg p-3 border border-border/40 flex items-start gap-2">
                  <Heart className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm leading-relaxed">{profile.whyCustomersBuy || "Not detected"}</p>
                </div>
              </div>
            </div>

            {/* What happens next */}
            <div className="card-elevated p-5 bg-muted/30">
              <h3 className="text-sm font-semibold mb-3">What happens next?</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Once you confirm, we&apos;ll use this profile to discover your competitors and start monitoring them with these four intelligence modules:
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: Newspaper, label: "News monitoring", desc: "Track press coverage & announcements" },
                  { icon: ShoppingBag, label: "Product tracking", desc: "Monitor new launches & pricing" },
                  { icon: Globe, label: "Web mentions", desc: "Find online discussions & reviews" },
                  { icon: Briefcase, label: "Hiring intel", desc: "See job postings & priorities" },
                ].map((item) => (
                  <div key={item.label} className="flex items-start gap-2">
                    <item.icon className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium">{item.label}</p>
                      <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <Button variant="outline" onClick={() => setStep("edit")}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                Edit profile
              </Button>
              <Button
                onClick={() =>
                  confirmMutation.mutate({ ...profile, domain: cleanDomain })
                }
                disabled={confirmMutation.isPending}
              >
                {confirmMutation.isPending ? (
                  "Saving..."
                ) : (
                  <>
                    Looks good, find competitors
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>

            <div className="flex items-start gap-2 text-xs text-muted-foreground pt-1">
              <Shield className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <p>Your company data is stored locally and never shared. You can edit this profile anytime from the Company Profile page.</p>
            </div>

            {confirmMutation.isError && (
              <div className="card-elevated p-4 border-red-200 bg-red-50">
                <p className="text-destructive text-sm font-medium">Failed to save profile</p>
                <p className="text-destructive/70 text-xs mt-1">Please try again. If the issue persists, check your connection.</p>
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/*  STEP 3: Edit profile (editable form)                        */}
        {/* ============================================================ */}
        {step === "edit" && profile && (
          <div className="space-y-5 animate-fade-in">
            <div className="page-header mb-2">
              <h1>Edit your company profile</h1>
              <p>
                Adjust any fields below. Accurate information leads to better competitor matching and more relevant scoring.
              </p>
            </div>

            {/* Company info section */}
            <div className="card-elevated p-6">
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Company info</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-5">
                Basic information about your business. This helps us find relevant competitors in your industry.
              </p>
              <div className="space-y-4">
                <div>
                  <Label className="mb-1 block">Company name</Label>
                  <p className="text-[11px] text-muted-foreground mb-1.5">Your brand or business name as known publicly.</p>
                  <Input
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  />
                </div>

                <div>
                  <Label className="mb-1 block">Short description</Label>
                  <p className="text-[11px] text-muted-foreground mb-1.5">
                    A brief description of what your company does. This is used to match competitors with similar offerings.
                  </p>
                  <Textarea
                    value={profile.description}
                    onChange={(e) =>
                      setProfile({ ...profile, description: e.target.value })
                    }
                    rows={3}
                  />
                </div>

                <div>
                  <Label className="mb-1 block">Industry</Label>
                  <p className="text-[11px] text-muted-foreground mb-1.5">
                    Select the industry that best matches your business.
                  </p>
                  <Select
                    value={profile.industry}
                    onValueChange={(v) => setProfile({ ...profile, industry: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INDUSTRIES.map((i) => (
                        <SelectItem key={i} value={i}>
                          {i}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Target customer section */}
            <div className="card-elevated p-6">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Target customer</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-5">
                Understanding your customers helps us score competitive events by how much they could impact your market.
              </p>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="mb-1 block">Age range</Label>
                    <Input
                      value={profile.targetCustomer.ageRange}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          targetCustomer: { ...profile.targetCustomer, ageRange: e.target.value },
                        })
                      }
                      placeholder="e.g. 25-40"
                    />
                  </div>
                  <div>
                    <Label className="mb-1 block">Geography</Label>
                    <Input
                      value={profile.targetCustomer.geography}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          targetCustomer: { ...profile.targetCustomer, geography: e.target.value },
                        })
                      }
                      placeholder="e.g. US & Canada"
                    />
                  </div>
                </div>

                <div>
                  <Label className="mb-1 block">Personality traits (comma-separated)</Label>
                  <Input
                    value={profile.targetCustomer.traits.join(", ")}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        targetCustomer: {
                          ...profile.targetCustomer,
                          traits: e.target.value.split(",").map((t) => t.trim()).filter(Boolean),
                        },
                      })
                    }
                    placeholder="e.g. eco-conscious, style-driven, budget-minded"
                  />
                </div>

                <div>
                  <Label className="mb-1 block">Why customers buy from you</Label>
                  <Textarea
                    value={profile.whyCustomersBuy}
                    onChange={(e) =>
                      setProfile({ ...profile, whyCustomersBuy: e.target.value })
                    }
                    rows={3}
                    placeholder="e.g. We offer the widest selection of organic products with free same-day delivery."
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <Button variant="outline" onClick={() => setStep("review")}>
                Back to review
              </Button>
              <Button
                onClick={() =>
                  confirmMutation.mutate({ ...profile, domain: cleanDomain })
                }
                disabled={confirmMutation.isPending}
              >
                {confirmMutation.isPending ? (
                  "Saving..."
                ) : (
                  <>
                    Save & find competitors
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>

            {confirmMutation.isError && (
              <div className="card-elevated p-4 border-red-200 bg-red-50">
                <p className="text-destructive text-sm font-medium">Failed to save profile</p>
                <p className="text-destructive/70 text-xs mt-1">Please try again.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
