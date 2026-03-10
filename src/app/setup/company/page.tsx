"use client";

import { useState } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";

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

export default function CompanySetupPage() {
  const router = useRouter();
  const [domain, setDomain] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);

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
    onSuccess: (data) => setProfile(data),
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
    enrichMutation.mutate(d);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold mb-2">Set up your company</h1>
      <p className="text-muted-foreground mb-8">
        Enter your domain and we&apos;ll auto-populate your profile using AI.
      </p>

      {!profile && (
        <form onSubmit={handleEnrich} className="flex gap-3">
          <Input
            placeholder="yourcompany.com"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            required
            className="flex-1"
          />
          <Button type="submit" disabled={enrichMutation.isPending}>
            {enrichMutation.isPending ? "Analyzing…" : "Analyze"}
          </Button>
        </form>
      )}

      {enrichMutation.isPending && (
        <div className="mt-8 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {enrichMutation.isError && (
        <p className="mt-4 text-destructive text-sm">
          Failed to analyze domain. Check the URL and try again.
        </p>
      )}

      {profile && (
        <div className="mt-8 space-y-5">
          <div>
            <Label>Company name</Label>
            <Input
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            />
          </div>

          <div>
            <Label>Short description</Label>
            <Textarea
              value={profile.description}
              onChange={(e) =>
                setProfile({ ...profile, description: e.target.value })
              }
              rows={3}
            />
          </div>

          <div>
            <Label>Industry</Label>
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Age range</Label>
              <Input
                value={profile.targetCustomer.ageRange}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    targetCustomer: {
                      ...profile.targetCustomer,
                      ageRange: e.target.value,
                    },
                  })
                }
                placeholder="e.g. 25–40"
              />
            </div>
            <div>
              <Label>Geography</Label>
              <Input
                value={profile.targetCustomer.geography}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    targetCustomer: {
                      ...profile.targetCustomer,
                      geography: e.target.value,
                    },
                  })
                }
                placeholder="e.g. US & Canada"
              />
            </div>
          </div>

          <div>
            <Label>Personality traits (comma-separated)</Label>
            <Input
              value={profile.targetCustomer.traits.join(", ")}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  targetCustomer: {
                    ...profile.targetCustomer,
                    traits: e.target.value
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean),
                  },
                })
              }
              placeholder="e.g. eco-conscious, style-driven"
            />
          </div>

          <div>
            <Label>Why customers buy from you</Label>
            <Textarea
              value={profile.whyCustomersBuy}
              onChange={(e) =>
                setProfile({ ...profile, whyCustomersBuy: e.target.value })
              }
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setProfile(null)}
            >
              Start over
            </Button>
            <Button
              onClick={() =>
                confirmMutation.mutate({
                  ...profile,
                  domain: domain.trim().replace(/^https?:\/\//, "").replace(/\/$/, ""),
                })
              }
              disabled={confirmMutation.isPending}
            >
              {confirmMutation.isPending ? "Saving…" : "Confirm & find competitors →"}
            </Button>
          </div>

          {confirmMutation.isError && (
            <p className="text-destructive text-sm">Save failed. Try again.</p>
          )}
        </div>
      )}
    </div>
  );
}
