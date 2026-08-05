// packages/ui/src/components/ui/dashboard/ai-insights.tsx
"use client";

import { memo, useMemo } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Sparkles, AlertTriangle, Info, Lightbulb, TrendingUp } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   AIInsights v4 — Mobile-optimized · Desktop pixel-perfect
   ═══════════════════════════════════════════════════════════════════════════ */

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
} as const;

const toneStyles = {
  warning: {
    border: "border-[hsl(var(--status-warning)/0.3)]",
    bg: "bg-[hsl(var(--status-warning)/0.05)]",
    icon: "text-[hsl(var(--status-warning))]",
  },
  info: {
    border: "border-[hsl(var(--status-info)/0.3)]",
    bg: "bg-[hsl(var(--status-info)/0.05)]",
    icon: "text-[hsl(var(--status-info))]",
  },
  success: {
    border: "border-[hsl(var(--status-positive)/0.3)]",
    bg: "bg-[hsl(var(--status-positive)/0.05)]",
    icon: "text-[hsl(var(--status-positive))]",
  },
  tip: {
    border: "border-[hsl(var(--color-primary)/0.3)]",
    bg: "bg-[hsl(var(--color-primary)/0.05)]",
    icon: "text-[hsl(var(--color-primary))]",
  },
} as const;

type InsightType = keyof typeof toneStyles;

// ─── Loading Skeleton ──────────────────────────────────────────────────────

const InsightsSkeleton = memo(function InsightsSkeleton() {
  return (
    <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-3 sm:mb-4">
        <div className="h-4 sm:h-5 w-4 sm:w-5 rounded bg-[hsl(var(--surface-muted))] animate-pulse" />
        <div className="h-4 sm:h-5 w-24 sm:w-32 rounded bg-[hsl(var(--surface-muted))] animate-pulse" />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 sm:h-16 rounded-xl bg-[hsl(var(--surface-muted))] animate-pulse" />
        ))}
      </div>
    </div>
  );
});
InsightsSkeleton.displayName = "InsightsSkeleton";

// ─── Empty State ────────────────────────────────────────────────────────────

const InsightsEmpty = memo(function InsightsEmpty() {
  const t = useTranslations();
  return (
    <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4 sm:p-6 text-center">
      <Sparkles className="size-6 sm:size-8 mx-auto mb-1.5 sm:mb-2 text-[hsl(var(--fg-tertiary))]" />
      <p className="text-xs sm:text-sm text-[hsl(var(--fg-secondary))]">
        {t("dashboard.noInsights")}
      </p>
    </div>
  );
});
InsightsEmpty.displayName = "InsightsEmpty";

// ─── Insight Item ──────────────────────────────────────────────────────────

const InsightItem = memo(function InsightItem({
  insight,
  onAction,
}: {
  insight: Insight;
  onAction: (action: string) => void;
}) {
  const Icon = iconMap[insight.type as InsightType];
  const tone = toneStyles[insight.type as InsightType];

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 sm:gap-3 p-3 sm:p-4 rounded-xl border",
        tone.border,
        tone.bg
      )}
    >
      <div className={cn("shrink-0 mt-0.5", tone.icon)}>
        <Icon className="size-4 sm:size-5" aria-hidden="true" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs sm:text-sm font-semibold text-[hsl(var(--fg-primary))] line-clamp-1">
          {insight.title}
        </p>
        <p className="text-[10px] sm:text-xs text-[hsl(var(--fg-secondary))] mt-0.5 line-clamp-2">
          {insight.description}
        </p>

        {insight.action && insight.actionLabel && (
          <button
            type="button"
            onClick={() => onAction(insight.action!)}
            className="text-[10px] sm:text-xs font-medium text-[hsl(var(--color-primary))] hover:underline mt-1"
          >
            {insight.actionLabel}
          </button>
        )}
      </div>

      {insight.metric != null && (
        <span className="text-base sm:text-lg font-bold tabular-nums text-[hsl(var(--fg-primary))] shrink-0">
          {insight.metric}
        </span>
      )}
    </div>
  );
});
InsightItem.displayName = "InsightItem";

// ─── Main Component ─────────────────────────────────────────────────────────

export const AIInsights = memo(function AIInsights({
  insights,
  isLoading,
  onAction,
}: AIInsightsProps) {
  const t = useTranslations();

  const insightItems = useMemo(
    () =>
      insights.map((insight, i) => (
        <InsightItem
          key={i}
          insight={insight}
          onAction={onAction || (() => {})}
        />
      )),
    [insights, onAction]
  );

  if (isLoading) {
    return <InsightsSkeleton />;
  }

  if (!insights || insights.length === 0) {
    return <InsightsEmpty />;
  }

  return (
    <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4 sm:p-6">
      <div className="flex items-center gap-1.5 sm:gap-2 mb-3 sm:mb-4">
        <Sparkles className="size-4 sm:size-5 text-[hsl(var(--color-primary))]" aria-hidden="true" />
        <h2 className="text-sm sm:text-base font-semibold text-[hsl(var(--fg-primary))]">
          {t("dashboard.smartInsights")}
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:gap-3">{insightItems}</div>
    </div>
  );
});

AIInsights.displayName = "AIInsights";