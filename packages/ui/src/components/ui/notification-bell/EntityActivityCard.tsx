// packages/ui/src/components/ui/notification-bell/EntityActivityCard.tsx
"use client";

import { useState, memo, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  ChevronDown,
  User,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  FileText,
  XCircle,
  Send,
  Archive,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEntitySummary, useEntityActivities } from "@hisabche/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EntityActivityCardProps {
  entityType: string;
  entityId: string;
  hasUnread: boolean;
  onActivityClick: (activity: any) => void;
}

// ─── Config ──────────────────────────────────────────────────────────────────

const statusColors: Record<string, string> = {
  pending: "text-amber-500 bg-amber-500/10",
  paid: "text-emerald-500 bg-emerald-500/10",
  completed: "text-emerald-500 bg-emerald-500/10",
  cancelled: "text-red-500 bg-red-500/10",
  partial: "text-blue-500 bg-blue-500/10",
  overdue: "text-rose-500 bg-rose-500/10",
  draft: "text-gray-500 bg-gray-500/10",
};

const statusLabels: Record<string, string> = {
  pending: "در انتظار",
  paid: "پرداخت شده",
  completed: "تکمیل شده",
  cancelled: "لغو شده",
  partial: "بخشی پرداخت",
  overdue: "سررسید شده",
  draft: "پیش‌نویس",
};

const activityIcons = {
  created: CheckCircle2,
  updated: FileText,
  status_changed: RefreshCw,
  payment: DollarSign,
  approved: ShieldCheck,
  rejected: AlertTriangle,
  sent: Send,
  archived: Archive,
  cancelled: XCircle,
};

const activityLabels: Record<string, string> = {
  created: "ایجاد شد",
  updated: "ویرایش شد",
  status_changed: "تغییر وضعیت",
  payment: "پرداخت",
  approved: "تأیید شد",
  rejected: "رد شد",
  sent: "ارسال شد",
  archived: "بایگانی شد",
  cancelled: "لغو شد",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(date: string, t: (key: string, fallback: string) => string): string {
  const now = Date.now();
  const diff = now - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return t("time.justNow");
  if (minutes < 60) return t("time.minutesAgo");
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("time.hoursAgo");
  
  const days = Math.floor(hours / 24);
  if (days < 7) return t("time.daysAgo");
  
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return t("time.weeksAgo");
  
  const months = Math.floor(days / 30);
  if (months < 12) return t("time.monthsAgo");
  
  return t("time.yearsAgo");
}

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("fa-AF", {
      style: "currency",
      currency: currency || "AFN",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount} ${currency || "AFN"}`;
  }
}

// ─── Sub-components ─────────────────────────────────────────────────────────

const StatusBadge = memo(function StatusBadge({
  status,
}: {
  status: string;
}) {
  const colorClass = statusColors[status] || "text-gray-500 bg-gray-500/10";
  const labelKey = statusLabels[status] || status;

  return (
    <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded", colorClass)}>
      {labelKey}
    </span>
  );
});
StatusBadge.displayName = "StatusBadge";

const ActivityIcon = memo(function ActivityIcon({
  type,
}: {
  type: keyof typeof activityIcons;
}) {
  const Icon = activityIcons[type] || CheckCircle2;
  return (
    <div className="w-6 h-6 rounded-full bg-[hsl(var(--surface-muted))] flex items-center justify-center group-hover:bg-[hsl(var(--surface-muted)/0.8)] transition-colors">
      <Icon className="w-3.5 h-3.5 text-[hsl(var(--fg-tertiary))]" />
    </div>
  );
});
ActivityIcon.displayName = "ActivityIcon";

// ─── Skeleton ────────────────────────────────────────────────────────────────

const CardSkeleton = memo(function CardSkeleton() {
  return (
    <div className="p-3 border border-[hsl(var(--border-default))] rounded-xl animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-[hsl(var(--surface-muted))]" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-[hsl(var(--surface-muted))] rounded w-3/4" />
          <div className="h-3 bg-[hsl(var(--surface-muted))] rounded w-1/2" />
          <div className="h-3 bg-[hsl(var(--surface-muted))] rounded w-1/3" />
        </div>
      </div>
    </div>
  );
});
CardSkeleton.displayName = "CardSkeleton";

const TimelineSkeleton = memo(function TimelineSkeleton() {
  return (
    <div className="space-y-2 py-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-start gap-3 animate-pulse">
          <div className="w-6 h-6 rounded-full bg-[hsl(var(--surface-muted))]" />
          <div className="flex-1 space-y-1">
            <div className="h-4 bg-[hsl(var(--surface-muted))] rounded w-3/4" />
            <div className="h-3 bg-[hsl(var(--surface-muted))] rounded w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
});
TimelineSkeleton.displayName = "TimelineSkeleton";

// ─── Empty Timeline ─────────────────────────────────────────────────────────

const EmptyTimeline = memo(function EmptyTimeline({
  t,
}: {
  t: (key: string) => string;
}) {
  return (
    <div className="py-4 text-center">
      <p className="text-sm text-[hsl(var(--fg-tertiary))]">
        {t("entity.activity.empty")}
      </p>
    </div>
  );
});
EmptyTimeline.displayName = "EmptyTimeline";

// ─── Main Component ─────────────────────────────────────────────────────────

export const EntityActivityCard = memo(function EntityActivityCard({
  entityType,
  entityId,
  hasUnread,
  onActivityClick,
}: EntityActivityCardProps) {
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(false);

  const { data: summary, isLoading: summaryLoading } = useEntitySummary(entityType, entityId);
  const { data: activities, isLoading: activitiesLoading } = useEntityActivities(entityType, entityId);

  const toggle = useCallback(() => setIsOpen((p) => !p), []);

  if (summaryLoading) {
    return <CardSkeleton />;
  }

  if (!summary) return null;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className={cn(
        "rounded-xl border border-[hsl(var(--border-default))] overflow-hidden",
        "transition-all duration-200",
        hasUnread && "border-[hsl(var(--color-primary)/0.3)] shadow-sm"
      )}
    >
      {/* ─── Header ─────────────────────────────────────────── */}
      <button
        type="button"
        onClick={toggle}
        className="w-full text-start p-3 hover:bg-[hsl(var(--surface-muted))] transition-colors duration-150"
      >
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="w-10 h-10 rounded-full bg-[hsl(var(--color-primary)/0.1)] flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-[hsl(var(--color-primary))]" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Label + Unread Indicator */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[hsl(var(--fg-primary))] truncate">
                {summary.label}
              </span>
              {hasUnread && (
                <span className="shrink-0 w-2 h-2 rounded-full bg-[hsl(var(--color-destructive))]" />
              )}
            </div>

            {/* Subtitle + Amount */}
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {summary.subtitle && (
                <span className="text-xs text-[hsl(var(--fg-secondary))] flex items-center gap-1">
                  <User className="w-3 h-3" aria-hidden="true" />
                  {summary.subtitle}
                </span>
              )}
              {summary.amount !== undefined && (
                <span className="text-xs font-semibold text-[hsl(var(--fg-primary))] flex items-center gap-1">
                  <DollarSign className="w-3 h-3" aria-hidden="true" />
                  {formatCurrency(summary.amount, summary.currency || "AFN")}
                </span>
              )}
            </div>

            {/* Status + Activity Count */}
            <div className="flex items-center gap-2 mt-1">
              {summary.status && (
                <StatusBadge status={summary.status} />
              )}
              <span className="text-[10px] text-[hsl(var(--fg-tertiary))] flex items-center gap-1">
                <Clock className="w-3 h-3" aria-hidden="true" />
                {t("entity.activity.count", { count: summary.activityCount })}
              </span>
              {summary.lastActivity && (
                <span className="text-[10px] text-[hsl(var(--fg-tertiary))] flex items-center gap-1">
                  •
                  {timeAgo(summary.lastActivity.time, t)}
                </span>
              )}
            </div>
          </div>

          {/* Chevron */}
          <ChevronDown
            className={cn(
              "w-4 h-4 shrink-0 text-[hsl(var(--fg-tertiary))] transition-transform duration-200 mt-1",
              isOpen && "rotate-180"
            )}
          />
        </div>
      </button>

      {/* ─── Timeline ───────────────────────────────────────── */}
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <div className="px-3 pb-3 pt-1 border-t border-[hsl(var(--border-default)/0.5)]">
            {activitiesLoading ? (
              <TimelineSkeleton />
            ) : !activities || activities.length === 0 ? (
              <EmptyTimeline t={t} />
            ) : (
              <div className="space-y-2">
                {activities.map((activity, index) => {
                  const isLast = index === activities.length - 1;
                  const type = activity.type as keyof typeof activityIcons;

                  return (
                    <button
                      key={activity.id}
                      onClick={() => onActivityClick(activity)}
                      className="w-full text-start flex items-start gap-3 group"
                    >
                      <div className="flex flex-col items-center shrink-0">
                        <ActivityIcon type={type} />
                        {!isLast && (
                          <div className="w-px h-3 bg-[hsl(var(--border-default))]" />
                        )}
                      </div>
                      <div className="flex-1 pb-2">
                        <p className="text-sm text-[hsl(var(--fg-primary))] group-hover:text-[hsl(var(--color-primary))] transition-colors">
                          {activity.title}
                        </p>
                        {activity.description && (
                          <p className="text-xs text-[hsl(var(--fg-secondary))] mt-0.5">
                            {activity.description}
                          </p>
                        )}
                        <p className="text-[10px] text-[hsl(var(--fg-tertiary))] mt-0.5">
                          {new Date(activity.timestamp).toLocaleTimeString(
                            "fa-AF",
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

EntityActivityCard.displayName = "EntityActivityCard";