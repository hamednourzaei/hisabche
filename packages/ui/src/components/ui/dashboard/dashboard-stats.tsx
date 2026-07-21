// packages/ui/src/components/ui/dashboard/dashboard-stats.tsx
"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import { 
  ArrowUpRight, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  CheckCircle2,
  type LucideIcon 
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   InsightCard v4 — Mobile-optimized · Desktop pixel-perfect
   ═══════════════════════════════════════════════════════════════════════════ */

type Status = "success" | "warning" | "danger" | "info";

interface InsightCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  status: Status;
  comparison?: {
    value: number;
    label: string;
    isPositive: boolean;
  };
  target?: {
    current: number;
    target: number;
    label: string;
  };
  alert?: {
    count: number;
    severity: "low" | "medium" | "high";
  };
  hint?: string;
  actionLabel?: string;
  onClick?: () => void;
  isLoading?: boolean;
  className?: string;
  size?: "small" | "medium" | "large";
}

// ─── Constants ──────────────────────────────────────────────────────────────

const STATUS_STYLES = {
  success: {
    bg: "from-[hsl(var(--status-positive)/0.12)] to-[hsl(var(--status-positive)/0.04)]",
    border: "border-[hsl(var(--status-positive)/0.2)]",
    icon: "bg-[hsl(var(--status-positive)/0.15)] text-[hsl(var(--status-positive))]",
    text: "text-[hsl(var(--status-positive))]",
  },
  warning: {
    bg: "from-[hsl(var(--status-warning)/0.12)] to-[hsl(var(--status-warning)/0.04)]",
    border: "border-[hsl(var(--status-warning)/0.2)]",
    icon: "bg-[hsl(var(--status-warning)/0.15)] text-[hsl(var(--status-warning))]",
    text: "text-[hsl(var(--status-warning))]",
  },
  danger: {
    bg: "from-[hsl(var(--status-negative)/0.12)] to-[hsl(var(--status-negative)/0.04)]",
    border: "border-[hsl(var(--status-negative)/0.2)]",
    icon: "bg-[hsl(var(--status-negative)/0.15)] text-[hsl(var(--status-negative))]",
    text: "text-[hsl(var(--status-negative))]",
  },
  info: {
    bg: "from-[hsl(var(--status-info)/0.12)] to-[hsl(var(--status-info)/0.04)]",
    border: "border-[hsl(var(--status-info)/0.2)]",
    icon: "bg-[hsl(var(--status-info)/0.15)] text-[hsl(var(--status-info))]",
    text: "text-[hsl(var(--status-info))]",
  },
} as const;

const SIZE_STYLES = {
  small: {
    container: "p-2.5 sm:p-3",
    value: "text-base sm:text-lg",
    label: "text-[9px] sm:text-xs",
    icon: "h-6 w-6 sm:h-8 sm:w-8",
    iconSize: "h-3.5 w-3.5 sm:h-4 sm:w-4",
  },
  medium: {
    container: "p-3 sm:p-4",
    value: "text-xl sm:text-2xl",
    label: "text-[10px] sm:text-sm",
    icon: "h-7 w-7 sm:h-8 sm:w-8",
    iconSize: "h-4 w-4 sm:h-4 sm:w-4",
  },
  large: {
    container: "p-4 sm:p-6",
    value: "text-2xl sm:text-4xl",
    label: "text-xs sm:text-base",
    icon: "h-8 w-8 sm:h-10 sm:w-10",
    iconSize: "h-4.5 w-4.5 sm:h-5 sm:w-5",
  },
} as const;

// ─── Progress Bar ──────────────────────────────────────────────────────────

const ProgressBar = memo(function ProgressBar({
  current,
  target,
  label,
}: {
  current: number;
  target: number;
  label: string;
}) {
  const percentage = Math.min((current / target) * 100, 100);
  
  return (
    <div className="mt-1.5 sm:mt-2 space-y-0.5 sm:space-y-1">
      <div className="flex justify-between text-[9px] sm:text-xs">
        <span className="text-[hsl(var(--fg-tertiary))] truncate">{label}</span>
        <span className="font-medium text-[hsl(var(--fg-secondary))]">
          {percentage.toFixed(0)}%
        </span>
      </div>
      <div className="h-1 sm:h-1.5 w-full rounded-full bg-[hsl(var(--surface-muted))]">
        <div
          className="h-full rounded-full bg-[hsl(var(--status-info))] transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
});
ProgressBar.displayName = "ProgressBar";

// ─── Alert Badge ──────────────────────────────────────────────────────────

const AlertBadge = memo(function AlertBadge({
  count,
  severity,
}: {
  count: number;
  severity: "low" | "medium" | "high";
}) {
  const severityStyles = {
    low: "bg-[hsl(var(--status-warning)/0.2)] text-[hsl(var(--status-warning))]",
    medium: "bg-[hsl(var(--status-negative)/0.2)] text-[hsl(var(--status-negative))]",
    high: "bg-[hsl(var(--status-negative)/0.3)] text-[hsl(var(--status-negative))] animate-pulse",
  };

  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 sm:gap-1 rounded-full px-1.5 sm:px-2 py-0.5 text-[8px] sm:text-[10px] font-medium",
      severityStyles[severity]
    )}>
      <AlertTriangle className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
      {count}
    </span>
  );
});
AlertBadge.displayName = "AlertBadge";

// ─── Main Component ──────────────────────────────────────────────────────

export const InsightCard = memo(function InsightCard({
  label,
  value,
  icon: Icon,
  status,
  comparison,
  target,
  alert,
  hint,
  actionLabel = "مشاهده جزئیات",
  onClick,
  isLoading = false,
  className,
  size = "medium",
}: InsightCardProps) {
  const Wrap = onClick ? "button" : "div";
  const styles = STATUS_STYLES[status];
  const sizeStyles = SIZE_STYLES[size];

  if (isLoading) {
    return (
      <div className={cn(
        "rounded-2xl bg-[hsl(var(--surface-muted))] animate-pulse",
        sizeStyles.container,
        className
      )}>
        <div className="h-full w-full bg-gradient-to-r from-transparent via-[hsl(var(--surface-elevated)/0.3)] to-transparent animate-shimmer" />
      </div>
    );
  }

  return (
    <Wrap
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className={cn(
        "relative flex flex-col gap-2 sm:gap-3 rounded-2xl text-start w-full transition-all duration-200",
        "border",
        styles.border,
        "bg-gradient-to-br",
        styles.bg,
        onClick && [
          "cursor-pointer",
          "hover:shadow-lg hover:-translate-y-0.5",
          "focus-visible:ring-4 focus-visible:ring-[hsl(var(--status-info)/0.3)] focus-visible:outline-none",
        ],
        sizeStyles.container,
        className
      )}
      aria-label={`${label}: ${value}`}
    >
      {/* Header: Icon + Label + Status */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <div className={cn(
            "flex items-center justify-center rounded-lg shrink-0",
            sizeStyles.icon,
            styles.icon
          )}>
            <Icon className={sizeStyles.iconSize} aria-hidden="true" />
          </div>
          <span className={cn(
            "font-medium truncate",
            sizeStyles.label,
            "text-[hsl(var(--fg-secondary))]"
          )}>
            {label}
          </span>
        </div>
        
        {/* Alert Badge */}
        {alert && alert.count > 0 && (
          <AlertBadge count={alert.count} severity={alert.severity} />
        )}
      </div>

      {/* Value */}
      <div className="space-y-0.5 sm:space-y-1">
        <p className={cn(
          "font-bold tabular-nums text-[hsl(var(--fg-primary))]",
          sizeStyles.value
        )}>
          {value}
        </p>

        {/* Comparison */}
        {comparison && (
          <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
            <span className={cn(
              "flex items-center gap-0.5 text-[9px] sm:text-xs font-medium",
              comparison.isPositive ? "text-[hsl(var(--status-positive))]" : "text-[hsl(var(--status-negative))]"
            )}>
              {comparison.isPositive ? (
                <TrendingUp className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
              ) : (
                <TrendingDown className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
              )}
              {comparison.isPositive ? "+" : ""}{comparison.value}%
            </span>
            <span className="text-[9px] sm:text-xs text-[hsl(var(--fg-tertiary))] truncate">
              {comparison.label}
            </span>
          </div>
        )}

        {/* Target Progress */}
        {target && (
          <ProgressBar
            current={target.current}
            target={target.target}
            label={target.label}
          />
        )}

        {/* Hint */}
        {hint && (
          <p className="text-[9px] sm:text-xs text-[hsl(var(--fg-tertiary))] line-clamp-2">
            {hint}
          </p>
        )}
      </div>

      {/* Action Footer */}
      {onClick && (
        <div className="flex items-center justify-end pt-1 sm:pt-1.5 border-t border-[hsl(var(--border-default)/0.5)]">
          <span className="flex items-center gap-0.5 sm:gap-1 text-[9px] sm:text-xs font-medium text-[hsl(var(--status-info))]">
            {actionLabel}
            <ArrowUpRight className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
          </span>
        </div>
      )}
    </Wrap>
  );
});

InsightCard.displayName = "InsightCard";