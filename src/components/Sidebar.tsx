"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Rss,
  Activity,
  Radar,
  HelpCircle,
  Building2,
  ShoppingBag,
} from "lucide-react";

const NAV_ITEMS = [
  {
    href: "/feed",
    label: "Intelligence Feed",
    description: "News, launches, mentions & jobs",
    icon: Rss,
  },
  {
    href: "/monitoring",
    label: "Monitoring",
    description: "Run modules & track sync status",
    icon: Activity,
  },
  {
    href: "/company",
    label: "Company Profile",
    description: "Edit your company details",
    icon: Building2,
  },
  {
    href: "/company/products",
    label: "Your Products",
    description: "Manage your product catalog",
    icon: ShoppingBag,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  const { data: company } = useQuery<{
    name: string;
    domain: string;
    industry: string;
  } | null>({
    queryKey: ["company"],
    queryFn: () => fetch("/api/company").then((r) => r.json()),
    staleTime: 60_000,
  });

  const { data: competitors } = useQuery<Array<{ id: string }>>({
    queryKey: ["competitors"],
    queryFn: () => fetch("/api/competitors").then((r) => r.json()),
    staleTime: 60_000,
  });

  // Hide sidebar on setup pages
  if (pathname?.startsWith("/setup")) return null;

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-[240px] flex-col bg-sidebar text-sidebar-foreground">
      {/* Logo / Brand */}
      <div className="px-5 py-6 border-b border-sidebar-muted">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-accent">
            <Radar className="h-4 w-4 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-white leading-tight">Competitor Intel</span>
            <span className="text-[11px] text-sidebar-foreground/50 leading-tight">Competitive Intelligence Platform</span>
          </div>
        </div>

        {/* Company badge — links to /company */}
        {company?.name && (
          <Link href="/company" className="block mt-4">
            <div className={`flex items-center gap-2 rounded-lg px-3 py-2 transition-colors ${
              pathname === "/company"
                ? "bg-sidebar-muted"
                : "bg-sidebar-muted/60 hover:bg-sidebar-muted"
            }`}>
              <Building2 className="h-3.5 w-3.5 text-sidebar-foreground/50 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-white truncate">{company.name}</p>
                <p className="text-[10px] text-sidebar-foreground/40 truncate">
                  {company.domain} &middot; {competitors?.length ?? 0} competitor{(competitors?.length ?? 0) !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          </Link>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4">
        <p className="px-3 mb-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/30">
          Navigation
        </p>
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            // Exact match, or nested route match — but only if no other nav item is a closer prefix
            const isExact = pathname === item.href;
            const isNested = !isExact && (pathname?.startsWith(item.href + "/") ?? false);
            const isShadowed = isNested && NAV_ITEMS.some(
              (other) => other.href !== item.href && other.href.startsWith(item.href + "/") && pathname?.startsWith(other.href)
            );
            const isActive = isExact || (isNested && !isShadowed);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`group relative flex items-start gap-3 rounded-lg px-3 py-2.5 transition-all duration-150 ${
                    isActive
                      ? "bg-sidebar-muted text-white"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-muted/60 hover:text-white"
                  }`}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-sidebar-accent" />
                  )}
                  <div className={`flex h-7 w-7 items-center justify-center rounded-md flex-shrink-0 transition-colors ${
                    isActive
                      ? "bg-sidebar-accent/20 text-sidebar-accent"
                      : "bg-sidebar-muted/40 text-sidebar-foreground/50 group-hover:bg-sidebar-muted/80 group-hover:text-sidebar-foreground/70"
                  }`}>
                    <item.icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-sm font-medium block leading-tight">{item.label}</span>
                    <span className={`text-[11px] leading-tight block ${
                      isActive ? "text-sidebar-foreground/50" : "text-sidebar-foreground/35"
                    }`}>{item.description}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Help & info footer */}
      <div className="px-4 py-4 border-t border-sidebar-muted space-y-3">
        <div className="flex items-start gap-2 text-sidebar-foreground/40">
          <HelpCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          <p className="text-[11px] leading-relaxed">
            Data syncs automatically every day at 6:00 AM ET. You can also trigger manual syncs from Monitoring.
          </p>
        </div>
        <p className="text-[10px] text-sidebar-foreground/25">
          Competitor Intelligence v1.2
        </p>
      </div>
    </aside>
  );
}
