"use client";

import {
  Building2,
  ShoppingBag,
  Search,
  Sparkles,
  Rss,
  ChevronRight,
} from "lucide-react";

const STEPS = [
  {
    icon: Building2,
    label: "Your Company",
    desc: "AI reads your website and builds your profile",
    color: "bg-blue-100 text-blue-700",
    activeColor: "bg-blue-600 text-white",
  },
  {
    icon: ShoppingBag,
    label: "Your Products",
    desc: "Auto-fetched from Shopify or added manually",
    color: "bg-purple-100 text-purple-700",
    activeColor: "bg-purple-600 text-white",
  },
  {
    icon: Search,
    label: "Competitors Found",
    desc: "AI discovers businesses in your space",
    color: "bg-amber-100 text-amber-700",
    activeColor: "bg-amber-600 text-white",
  },
  {
    icon: Sparkles,
    label: "Events Scored",
    desc: "Each event scored by impact on YOUR products",
    color: "bg-emerald-100 text-emerald-700",
    activeColor: "bg-emerald-600 text-white",
  },
  {
    icon: Rss,
    label: "Intelligence Feed",
    desc: "Personalized stream of competitive signals",
    color: "bg-red-100 text-red-700",
    activeColor: "bg-red-600 text-white",
  },
];

interface IntelligencePipelineVisualProps {
  /** Which step (1-5) to highlight as current */
  highlightStep?: number;
  /** Compact mode for inline usage */
  compact?: boolean;
}

export function IntelligencePipelineVisual({
  highlightStep = 0,
  compact = false,
}: IntelligencePipelineVisualProps) {
  return (
    <div className={`${compact ? "" : "card-elevated p-5"} animate-fade-in`}>
      {!compact && (
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">
          How your intelligence pipeline works
        </p>
      )}
      <div className="flex items-start gap-1">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          const stepNum = i + 1;
          const isActive = stepNum === highlightStep;
          const isCompleted = stepNum < highlightStep;

          return (
            <div key={step.label} className="flex items-start flex-1 min-w-0">
              <div className="flex flex-col items-center text-center flex-1 min-w-0">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                    isActive
                      ? step.activeColor + " ring-2 ring-offset-2 ring-primary/30"
                      : isCompleted
                      ? step.activeColor + " opacity-80"
                      : step.color
                  }`}
                >
                  <Icon className={compact ? "h-4 w-4" : "h-4.5 w-4.5"} />
                </div>
                <p
                  className={`text-[11px] font-semibold mt-1.5 leading-tight ${
                    isActive ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {step.label}
                </p>
                {!compact && (
                  <p className="text-[10px] text-muted-foreground leading-snug mt-0.5 px-1">
                    {step.desc}
                  </p>
                )}
              </div>
              {i < STEPS.length - 1 && (
                <div className="flex items-center pt-3 px-0.5 flex-shrink-0">
                  <ChevronRight
                    className={`h-3.5 w-3.5 ${
                      stepNum < highlightStep
                        ? "text-primary/60"
                        : "text-muted-foreground/30"
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
