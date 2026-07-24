// packages/ui/src/components/ui/activity/EntityActivityCard.tsx
"use client";

import { useState, memo, useCallback } from "react";
import { useTranslation } from "react-i18next";
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
  Package,
  Users,
  Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActivityItemDto, EntitySummaryDto } from "@hisabche/api";
import { ActivityPreview } from "./ActivityPreview";

// ─── Types ────────────────────────────────────────────────────────────────────

// ✅ FIX: entitySummary and activities are now required props, coming
// straight from the /v1/activities response (ActivityGroupDto), which
// already contains everything needed. Previously this component fetched
// them itself via useEntitySummary/useEntityActivities against a
// /v1/activities/entity/:type/:id(/summary) route that either doesn't
// exist or fails — causing `if (!summary) return null`, i.e. the card
// silently rendering nothing while the virtualizer still reserved space
// for it (matching the "1 item counted, nothing shown" symptom).
interface EntityActivityCardProps {
  entityType: string;
  entityId: string;
  entitySummary: EntitySummaryDto;
  activities: ActivityItemDto[];
  hasUnread: boolean;
  onActivityClick: (activity: any) => void;
  compact?: boolean;
}

// ─── Entity Config ───────────────────────────────────────────────────────────

const entityConfig = {
  invoice: { icon: FileText, color: "text-blue-500", bg: "bg-blue-500/10", label: "فاکتور" },
  customer: { icon: Users, color: "text-purple-500", bg: "bg-purple-500/10", label: "مشتری" },
  product: { icon: Package, color: "text-amber-500", bg: "bg-amber-500/10", label: "محصول" },
  payment: { icon: Receipt, color: "text-emerald-500", bg: "bg-emerald-500/10", label: "پرداخت" },
  supplier: { icon: Users, color: "text-orange-500", bg: "bg-orange-500/10", label: "تأمین‌کننده" },
  inventory: { icon: Package, color: "text-rose-500", bg: "bg-rose-500/10", label: "انبار" },
};

// ─── Config ──────────────────────────────────────────────────────────────────

const statusColors: Record<string, string> = {
  pending: "text-amber-500 bg-amber-500/10",
  paid: "text-emerald-500 bg-emerald-500/10",
  completed: "text-emerald-500 bg-emerald-500/10",
  cancelled: "text-red-500 bg-red-500/10",
  partial: "text-blue-500 bg-blue-500/10",
  overdue: "text-rose-500 bg-rose-500/10",
  draft: "text-gray-500 bg-gray-500/10",
  approved: "text-purple-500 bg-purple-500/10",
  rejected: "text-red-500 bg-red-500/10",
};

const statusLabels: Record<string, string> = {
  pending: "در انتظار",
  paid: "پرداخت شده",
  completed: "تکمیل شده",
  cancelled: "لغو شده",
  partial: "بخشی پرداخت",
  overdue: "سررسید شده",
  draft: "پیش‌نویس",
  approved: "تأیید شده",
  rejected: "رد شده",
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
} as const;

type ActivityType = keyof typeof activityIcons;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(date: string, t: (key: string, fallback: string) => string): string {
  const now = Date.now();
  const diff = now - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return t("time.justNow", "همین الان");
  if (minutes < 60) return t("time.minutesAgo", `${minutes} دقیقه پیش`);

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("time.hoursAgo", `${hours} ساعت پیش`);

  const days = Math.floor(hours / 24);
  if (days < 7) return t("time.daysAgo", `${days} روز پیش`);

  const weeks = Math.floor(days / 7);
  if (weeks < 4) return t("time.weeksAgo", `${weeks} هفته پیش`);

  const months = Math.floor(days / 30);
  if (months < 12) return t("time.monthsAgo", `${months} ماه پیش`);

  return t("time.yearsAgo", `${Math.floor(months / 12)} سال پیش`);
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

function getEntityTypeKey(entityType: string): keyof typeof entityConfig {
  const type = entityType as keyof typeof entityConfig;
  return type in entityConfig ? type : "invoice";
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

// ─── Preview Component ──────────────────────────────────────────────────────

const PreviewContent = memo(function PreviewContent({
  summary,
}: {
  summary: EntitySummaryDto;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
        {summary.label}
      </h4>
      {summary.subtitle && (
        <p className="text-xs text-[hsl(var(--fg-secondary))]">
          {summary.subtitle}
        </p>
      )}
      {summary.amount !== undefined && (
        <p className="text-sm font-bold text-[hsl(var(--fg-primary))]">
          {formatCurrency(summary.amount, summary.currency || "AFN")}
        </p>
      )}
      <div className="flex items-center gap-2">
        {summary.status && <StatusBadge status={summary.status} />}
        <span className="text-[10px] text-[hsl(var(--fg-tertiary))]">
          {t("entity.activity.count", { count: summary.activityCount })} فعالیت
        </span>
      </div>
    </div>
  );
});
PreviewContent.displayName = "PreviewContent";

// ─── Empty Timeline ──────────────────────────────────────────────────────────

const EmptyTimeline = memo(function EmptyTimeline() {
  const { t } = useTranslation();
  return (
    <div className="py-4 text-center">
      <p className="text-sm text-[hsl(var(--fg-tertiary))]">
        {t("entity.activity.empty")}
      </p>
    </div>
  );
});
EmptyTimeline.displayName = "EmptyTimeline";

// ─── Timeline Item ──────────────────────────────────────────────────────────

const TimelineItem = memo(function TimelineItem({
  activity,
  isLast,
  onClick,
}: {
  activity: ActivityItemDto;
  isLast: boolean;
  onClick: () => void;
}) {
  const type = activity.action as ActivityType;
  const Icon = activityIcons[type] || CheckCircle2;

  return (
    <button
      onClick={onClick}
      className="w-full text-start flex items-start gap-3 group py-1.5 rounded-lg hover:bg-[hsl(var(--surface-muted))] transition-colors px-1"
    >
      <div className="flex flex-col items-center shrink-0">
        <div className="w-6 h-6 rounded-full bg-[hsl(var(--surface-muted))] flex items-center justify-center group-hover:bg-[hsl(var(--surface-muted)/0.8)] transition-colors">
          <Icon className="w-3.5 h-3.5 text-[hsl(var(--fg-tertiary))]" />
        </div>
        {!isLast && <div className="w-px h-3 bg-[hsl(var(--border-default))]" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[hsl(var(--fg-primary))] group-hover:text-[hsl(var(--color-primary))] transition-colors">
          {activity.title}
        </p>
        {activity.description && (
          <p className="text-xs text-[hsl(var(--fg-secondary))] mt-0.5">
            {activity.description}
          </p>
        )}
        <p className="text-[10px] text-[hsl(var(--fg-tertiary))] mt-0.5">
          {new Date(activity.timestamp).toLocaleTimeString("fa-AF", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </button>
  );
});
TimelineItem.displayName = "TimelineItem";

// ─── Main Component ─────────────────────────────────────────────────────────

export const EntityActivityCard = memo(function EntityActivityCard({
  entityType,
  entityId,
  entitySummary,
  activities,
  hasUnread,
  onActivityClick,
  compact = false,
}: EntityActivityCardProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const toggle = useCallback(() => setIsOpen((p) => !p), []);

  // ✅ FIX: no more loading/null state to worry about — entitySummary is
  // guaranteed by the parent (ActivityGroupDto always has it), so no
  // early `return null` that would leave reserved virtualizer space empty.
  const summary = entitySummary;

  const entityKey = getEntityTypeKey(entityType);
  const config = entityConfig[entityKey] || entityConfig.invoice;
  const Icon = config.icon;

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
      <ActivityPreview
        preview={<PreviewContent summary={summary} />}
        delay={600}
      >
        <button
          type="button"
          onClick={toggle}
          className="w-full text-start p-3 hover:bg-[hsl(var(--surface-muted))] transition-colors duration-150"
        >
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0", config.bg)}>
              <Icon className={cn("w-5 h-5", config.color)} />
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
                {!compact && (
                  <span className="text-[10px] text-[hsl(var(--fg-tertiary))] font-medium">
                    {config.label}
                  </span>
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
                {summary.status && <StatusBadge status={summary.status} />}
                <span className="text-[10px] text-[hsl(var(--fg-tertiary))] flex items-center gap-1">
                  <Clock className="w-3 h-3" aria-hidden="true" />
                  {!compact
                    ? t("entity.activity.count", { count: summary.activityCount })
                    : summary.activityCount}
                </span>
                {summary.lastActivity && (
                  <span className="text-[10px] text-[hsl(var(--fg-tertiary))] flex items-center gap-1">
                    •
                    {timeAgo(summary.lastActivity, (key: string, fallback: string) => t(key, fallback))}
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
      </ActivityPreview>

      {/* ─── Timeline ───────────────────────────────────────── */}
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <div className={cn(
            "px-3 pt-1 border-t border-[hsl(var(--border-default)/0.5)]",
            !compact ? "pb-3" : "pb-1"
          )}>
            {!activities || activities.length === 0 ? (
              <EmptyTimeline />
            ) : (
              <div className="space-y-0.5">
                {(compact ? activities.slice(0, 3) : activities).map((activity, index) => {
                  const isLast = index === (compact ? Math.min(3, activities.length) : activities.length) - 1;
                  return (
                    <TimelineItem
                      key={activity.id}
                      activity={activity}
                      isLast={isLast}
                      onClick={() => onActivityClick(activity)}
                    />
                  );
                })}
              </div>
            )}

            {/* ─── Show More ────────────────────────────────── */}
            {compact && activities && activities.length > 3 && (
              <button
                type="button"
                onClick={toggle}
                className="w-full text-center text-[10px] font-medium text-[hsl(var(--color-primary))] hover:underline py-1"
              >
                {t("activity.showMore", `نمایش ${activities.length - 3} فعالیت دیگر`)}
              </button>
            )}

            {/* ─── Footer ────────────────────────────────────── */}
            {!compact && (
              <div className="mt-2 pt-2 border-t border-[hsl(var(--border-default)/0.5)]">
                <button
                  type="button"
                  onClick={() => onActivityClick({ entityId, entityType })}
                  className="w-full text-center text-[10px] font-medium text-[hsl(var(--color-primary))] hover:underline py-1"
                >
                  {t("activity.open", "باز کردن")} {summary.label} →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

EntityActivityCard.displayName = "EntityActivityCard";