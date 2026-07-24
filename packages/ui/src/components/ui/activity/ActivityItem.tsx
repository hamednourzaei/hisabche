// packages/ui/src/components/ui/activity/ActivityItem.tsx
"use client";

import { memo, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  FileText,
  XCircle,
  Send,
  Archive,
  RefreshCw,
  DollarSign,
  User,
  Eye,
  MessageSquare,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActivityType =
  | "created"
  | "updated"
  | "status_changed"
  | "payment"
  | "approved"
  | "rejected"
  | "sent"
  | "archived"
  | "cancelled"
  | "viewed"
  | "commented";

export interface ActivityItemData {
  id: string;
  type: ActivityType;
  title: string;
  description?: string;
  timestamp: string;
  isRead?: boolean;
  actor?: string;
  metadata?: Record<string, unknown>;
}

export interface ActivityItemProps {
  activity: ActivityItemData;
  isLast: boolean;
  onClick?: (() => void) | undefined;
  className?: string;
  size?: "sm" | "md";
}

// ─── Activity Icons Config ──────────────────────────────────────────────────

const activityIcons: Record<ActivityType, { icon: any; color: string; bg: string }> = {
  created: { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  updated: { icon: CheckCircle2, color: "text-blue-500", bg: "bg-blue-500/10" },
  status_changed: { icon: RefreshCw, color: "text-amber-500", bg: "bg-amber-500/10" },
  payment: { icon: DollarSign, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  approved: { icon: ShieldCheck, color: "text-purple-500", bg: "bg-purple-500/10" },
  rejected: { icon: AlertTriangle, color: "text-red-500", bg: "bg-red-500/10" },
  sent: { icon: CheckCircle2, color: "text-blue-500", bg: "bg-blue-500/10" },
  archived: { icon: CheckCircle2, color: "text-gray-500", bg: "bg-gray-500/10" },
  cancelled: { icon: XCircle, color: "text-red-500", bg: "bg-red-500/10" },
  viewed: { icon: Eye, color: "text-slate-500", bg: "bg-slate-500/10" },
  commented: { icon: MessageSquare, color: "text-indigo-500", bg: "bg-indigo-500/10" },
};

// ─── Helper: Format Time ────────────────────────────────────────────────────

function formatTime(timestamp: string): string {
  try {
    return new Date(timestamp).toLocaleTimeString("fa-AF", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

// ─── Helper: Get Activity Icon ─────────────────────────────────────────────

function getActivityIcon(type: ActivityType) {
  return activityIcons[type] || activityIcons.created;
}

// ─── Main Component ─────────────────────────────────────────────────────────

export const ActivityItem = memo(function ActivityItem({
  activity,
  isLast,
  onClick,
  className,
  size = "md",
}: ActivityItemProps) {
  const { t } = useTranslation();
  const isSm = size === "sm";

  const config = useMemo(() => getActivityIcon(activity.type), [activity.type]);
  const Icon = config.icon;

  const timeString = useMemo(
    () => formatTime(activity.timestamp),
    [activity.timestamp]
  );

  const actorLabel = useMemo(() => {
    if (!activity.actor) return null;
    return t("activity.by", "توسط {{actor}}", { actor: activity.actor });
  }, [activity.actor, t]);

  const handleClick = useCallback(() => {
    if (onClick) {
      onClick();
    }
  }, [onClick]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (onClick) {
          onClick();
        }
      }
    },
    [onClick]
  );

  const amount = activity.metadata?.amount;
  const isAmountValid = typeof amount === "number";

  return (
    <div
      role="button"
      tabIndex={onClick ? 0 : -1}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "w-full text-start flex items-start gap-2 md:gap-3 group rounded-lg transition-colors",
        "hover:bg-[hsl(var(--surface-muted))]",
        onClick && "cursor-pointer",
        isSm ? "py-0.5 md:py-1 px-0.5 md:px-1" : "py-1 md:py-1.5 px-0.5 md:px-1",
        className
      )}
      aria-disabled={!onClick}
      aria-label={t("activity.itemLabel", "فعالیت: {{title}}", {
        title: activity.title,
      })}
    >
      {/* ─── Icon + Timeline Line ──────────────────────────────────────────── */}
      <div className="flex flex-col items-center shrink-0" aria-hidden="true">
        <div
          className={cn(
            "rounded-full flex items-center justify-center transition-colors",
            isSm ? "w-4 h-4 md:w-5 md:h-5" : "w-5 h-5 md:w-6 md:h-6",
            "bg-[hsl(var(--surface-muted))] group-hover:bg-[hsl(var(--surface-muted)/0.8)]",
            config.bg
          )}
        >
          <Icon
            className={cn(
              isSm ? "w-2.5 h-2.5 md:w-3 md:h-3" : "w-3 h-3 md:w-3.5 md:h-3.5",
              config.color
            )}
          />
        </div>
        {!isLast && (
          <div
            className={cn(
              "w-px bg-[hsl(var(--border-default))]",
              isSm ? "h-2 md:h-3" : "h-3 md:h-4"
            )}
          />
        )}
      </div>

      {/* ─── Content ────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
          <p
            className={cn(
              "text-[hsl(var(--fg-primary))] group-hover:text-[hsl(var(--color-primary))] transition-colors",
              isSm ? "text-[10px] md:text-xs" : "text-xs md:text-sm",
              "line-clamp-2"
            )}
          >
            {activity.title}
          </p>
          {!activity.isRead && (
            <span
              className="shrink-0 w-1.5 h-1.5 rounded-full bg-[hsl(var(--color-destructive))]"
              aria-label={t("activity.unread", "خوانده نشده")}
            />
          )}
        </div>

        {activity.description && (
          <p
            className={cn(
              "text-[hsl(var(--fg-secondary))] line-clamp-2",
              isSm ? "text-[8px] md:text-[10px] mt-0.5" : "text-[10px] md:text-xs mt-0.5"
            )}
          >
            {activity.description}
          </p>
        )}

        <div className="flex items-center gap-1.5 md:gap-2 mt-0.5 flex-wrap">
          {activity.actor && (
            <span className="text-[8px] md:text-[10px] text-[hsl(var(--fg-tertiary))] flex items-center gap-1">
              <User className="w-2.5 h-2.5 md:w-3 md:h-3" aria-hidden="true" />
              <span className="truncate max-w-[80px] md:max-w-none">{actorLabel}</span>
            </span>
          )}
          <span className="text-[8px] md:text-[10px] text-[hsl(var(--fg-tertiary))]">
            {timeString}
          </span>
          {isAmountValid && (
            <span className="text-[8px] md:text-[10px] font-medium text-[hsl(var(--fg-primary))]">
              {new Intl.NumberFormat("fa-AF", {
                style: "currency",
                currency: "AFN",
                maximumFractionDigits: 0,
              }).format(amount)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

ActivityItem.displayName = "ActivityItem";