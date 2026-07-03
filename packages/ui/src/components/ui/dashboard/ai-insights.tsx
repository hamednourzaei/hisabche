// packages/ui/src/components/ui/dashboard/ai-insights.tsx
"use client";

import { cn } from "@/lib/utils";
import { Sparkles, AlertTriangle, Info, Lightbulb, TrendingUp } from "lucide-react";

interface Insight {
  type: "warning" | "info" | "success" | "tip";
  title: string;
  description: string;
  action?: string;
  actionLabel?: string;
  metric?: number;
  metricLabel?: string;
}

interface AIInsightsProps {
  insights: Insight[];
  isLoading: boolean;
  onAction?: (action: string) => void;
}

const iconMap = {
  warning: AlertTriangle,
  info: Info,
  success: TrendingUp,
  tip: Lightbulb,
};

const toneStyles = {
  warning: {
    border: "border-[hsl(var(--color-warning)/0.3)]",
    bg: "bg-[hsl(var(--color-warning)/0.05)]",
    icon: "text-[hsl(var(--color-warning))]",
  },
  info: {
    border: "border-[hsl(var(--color-info)/0.3)]",
    bg: "bg-[hsl(var(--color-info)/0.05)]",
    icon: "text-[hsl(var(--color-info))]",
  },
  success: {
    border: "border-[hsl(var(--color-success)/0.3)]",
    bg: "bg-[hsl(var(--color-success)/0.05)]",
    icon: "text-[hsl(var(--color-success))]",
  },
  tip: {
    border: "border-[hsl(var(--color-primary)/0.3)]",
    bg: "bg-[hsl(var(--color-primary)/0.05)]",
    icon: "text-[hsl(var(--color-primary))]",
  },
};

export function AIInsights({ insights, isLoading, onAction }: AIInsightsProps) {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-5 w-5 rounded bg-[hsl(var(--surface-muted))] animate-pulse" />
          <div className="h-5 w-32 rounded bg-[hsl(var(--surface-muted))] animate-pulse" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-[hsl(var(--surface-muted))] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!insights || insights.length === 0) {
    return (
      <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-6 text-center">
        <Sparkles className="size-8 mx-auto mb-2 text-[hsl(var(--fg-tertiary))]" />
        <p className="text-sm text-[hsl(var(--fg-secondary))]">
          بینش هوشمند در دسترس نیست
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-6">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="size-5 text-[hsl(var(--color-primary))]" aria-hidden="true" />
        <h2 className="text-base font-semibold text-[hsl(var(--fg-primary))]">
          بینش هوشمند
        </h2>
      </div>

      <div className="space-y-3">
        {insights.map((insight, i) => {
          const Icon = iconMap[insight.type];
          const tone = toneStyles[insight.type];

          return (
            <div
              key={i}
              className={cn(
                "flex items-start gap-3 p-4 rounded-xl border",
                tone.border,
                tone.bg,
              )}
            >
              <div className={cn("shrink-0 mt-0.5", tone.icon)}>
                <Icon className="size-5" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
                  {insight.title}
                </p>
                <p className="text-xs text-[hsl(var(--fg-secondary))] mt-0.5">
                  {insight.description}
                </p>
                {insight.action && insight.actionLabel && onAction && (
                  <button
                    type="button"
                    onClick={() => onAction(insight.action!)}
                    className="text-xs font-medium text-[hsl(var(--color-primary))] hover:underline mt-1.5"
                  >
                    {insight.actionLabel}
                  </button>
                )}
              </div>
              {insight.metric != null && (
                <span className="text-lg font-bold tabular-nums text-[hsl(var(--fg-primary))] shrink-0">
                  {insight.metric}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}