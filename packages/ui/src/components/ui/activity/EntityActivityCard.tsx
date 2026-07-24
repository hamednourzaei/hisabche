// packages/ui/src/components/ui/activity/EntityActivityCard.tsx
"use client";

import { useState, memo, useCallback, useMemo } from "react";
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

interface EntityActivityCardProps {
  entityType: string;
  entityId: string;
  entitySummary: EntitySummaryDto;
  activities: ActivityItemDto[];
  hasUnread: boolean;
  onActivityClick: (activity: ActivityItemDto) => void;
  onOpenEntity?: (entityId: string, entityType: string) => void;
  compact?: boolean;
  maxDisplayItems?: number;
}

// ─── Entity Config ───────────────────────────────────────────────────────────

export const ENTITY_CONFIG = {
  invoice: { icon: FileText, color: "text-blue-500", bg: "bg-blue-500/10", label: "فاکتور" },
  customer: { icon: Users, color: "text-purple-500", bg: "bg-purple-500/10", label: "مشتری" },
  product: { icon: Package, color: "text-amber-500", bg: "bg-amber-500/10", label: "محصول" },
  payment: { icon: Receipt, color: "text-emerald-500", bg: "bg-emerald-500/10", label: "پرداخت" },
  supplier: { icon: Users, color: "text-orange-500", bg: "bg-orange-500/10", label: "تأمین‌کننده" },
  inventory: { icon: Package, color: "text-rose-500", bg: "bg-rose-500/10", label: "انبار" },
} as const;

export type EntityType = keyof typeof ENTITY_CONFIG;

// ─── Status Config ──────────────────────────────────────────────────────────

export const STATUS_CONFIG = {
  pending: { color: "text-amber-500 bg-amber-500/10", label: "در انتظار" },
  paid: { color: "text-emerald-500 bg-emerald-500/10", label: "پرداخت شده" },
  completed: { color: "text-emerald-500 bg-emerald-500/10", label: "تکمیل شده" },
  cancelled: { color: "text-red-500 bg-red-500/10", label: "لغو شده" },
  partial: { color: "text-blue-500 bg-blue-500/10", label: "بخشی پرداخت" },
  overdue: { color: "text-rose-500 bg-rose-500/10", label: "سررسید شده" },
  draft: { color: "text-gray-500 bg-gray-500/10", label: "پیش‌نویس" },
  approved: { color: "text-purple-500 bg-purple-500/10", label: "تأیید شده" },
  rejected: { color: "text-red-500 bg-red-500/10", label: "رد شده" },
} as const;

export type StatusKey = keyof typeof STATUS_CONFIG;

// ─── Activity Icons ─────────────────────────────────────────────────────────

export const ACTIVITY_ICONS = {
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

export type ActivityAction = keyof typeof ACTIVITY_ICONS;

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

function getEntityConfig(entityType: string) {
  const type = entityType as EntityType;
  return ENTITY_CONFIG[type] || ENTITY_CONFIG.invoice;
}

function getStatusConfig(status: string) {
  const key = status as StatusKey;
  return STATUS_CONFIG[key] || { color: "text-gray-500 bg-gray-500/10", label: status };
}

function getActivityIcon(action: string) {
  const key = action as ActivityAction;
  return ACTIVITY_ICONS[key] || CheckCircle2;
}

// ─── Sub-components ─────────────────────────────────────────────────────────

// ── Status Badge ──────────────────────────────────────────────

const StatusBadge = memo(function StatusBadge({ status }: { status: string }) {
  const config = getStatusConfig(status);

  return (
    <span className={cn(
      "text-[10px] md:text-xs font-medium px-1.5 py-0.5 rounded",
      config.color,
      "whitespace-nowrap"
    )}>
      {config.label}
    </span>
  );
});
StatusBadge.displayName = "StatusBadge";

// ── Timeline Item ─────────────────────────────────────────────

const TimelineItem = memo(function TimelineItem({
  activity,
  isLast,
  onClick,
}: {
  activity: ActivityItemDto;
  isLast: boolean;
  onClick: () => void;
}) {
  const Icon = getActivityIcon(activity.action);
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-start flex items-start gap-2 md:gap-3 group py-1 md:py-1.5 rounded-lg",
        "hover:bg-[hsl(var(--surface-muted))] transition-colors duration-150",
        "focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))] focus:ring-offset-1",
        "px-0.5 md:px-1"
      )}
    >
      <div className="flex flex-col items-center shrink-0">
        <div
          className={cn(
            "w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center",
            "bg-[hsl(var(--surface-muted))] group-hover:bg-[hsl(var(--surface-muted)/0.8)]",
            "transition-colors duration-150"
          )}
        >
          <Icon className="w-3 h-3 md:w-3.5 md:h-3.5 text-[hsl(var(--fg-tertiary))]" />
        </div>
        {!isLast && <div className="w-px h-2 md:h-3 bg-[hsl(var(--border-default))]" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs md:text-sm text-[hsl(var(--fg-primary))] group-hover:text-[hsl(var(--color-primary))] transition-colors line-clamp-2">
          {activity.title}
        </p>
        {activity.description && (
          <p className="text-[10px] md:text-xs text-[hsl(var(--fg-secondary))] mt-0.5 line-clamp-2">
            {activity.description}
          </p>
        )}
        <p className="text-[9px] md:text-[10px] text-[hsl(var(--fg-tertiary))] mt-0.5">
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

// ── Timeline List ─────────────────────────────────────────────

const TimelineList = memo(function TimelineList({
  activities,
  maxDisplay,
  onActivityClick,
  onShowMore,
  showMoreLabel,
}: {
  activities: ActivityItemDto[];
  maxDisplay?: number | undefined;
  onActivityClick: (activity: ActivityItemDto) => void;
  onShowMore?: () => void | undefined;
  showMoreLabel?: string;
}) {
  const { t } = useTranslation();

  const displayActivities = useMemo(() => {
    if (!maxDisplay || maxDisplay >= activities.length) {
      return activities;
    }
    return activities.slice(0, maxDisplay);
  }, [activities, maxDisplay]);

  const hasMore = maxDisplay && activities.length > maxDisplay;

  if (activities.length === 0) {
    return (
      <div className="py-3 md:py-4 text-center">
        <p className="text-xs md:text-sm text-[hsl(var(--fg-tertiary))]">
          {t("entity.activity.empty")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {displayActivities.map((activity, index) => {
        const isLast = index === displayActivities.length - 1;
        return (
          <TimelineItem
            key={activity.id}
            activity={activity}
            isLast={isLast}
            onClick={() => onActivityClick(activity)}
          />
        );
      })}

      {hasMore && onShowMore && (
        <button
          type="button"
          onClick={onShowMore}
          className="w-full text-center text-[9px] md:text-[10px] font-medium text-[hsl(var(--color-primary))] hover:underline py-1.5 md:py-2 mt-0.5 md:mt-1"
        >
          {showMoreLabel ||
            t("activity.showMore", `نمایش ${activities.length - (maxDisplay || 0)} فعالیت دیگر`)}
        </button>
      )}
    </div>
  );
});
TimelineList.displayName = "TimelineList";

// ─── Header Component ─────────────────────────────────────────

const CardHeader = memo(function CardHeader({
  summary,
  entityType,
  entityId,
  hasUnread,
  compact,
  isOpen,
  onToggle,
}: {
  summary: EntitySummaryDto;
  entityType: string;
  entityId: string;
  hasUnread: boolean;
  compact: boolean;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const config = getEntityConfig(entityType);
  const Icon = config.icon;

  const timeAgoText = useMemo(() => {
    if (!summary.lastActivity) return null;
    return timeAgo(summary.lastActivity, t);
  }, [summary.lastActivity, t]);

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      aria-controls={`timeline-${entityId || entityType}`}
      className={cn(
        "w-full text-start p-2 md:p-3 rounded-xl",
        "hover:bg-[hsl(var(--surface-muted))] transition-colors duration-150",
        "focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))] focus:ring-offset-1",
        "group"
      )}
    >
      <div className="flex items-start gap-2 md:gap-3">
        {/* Icon */}
        <div
          className={cn(
            "w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center shrink-0",
            config.bg,
            "group-hover:scale-105 transition-transform duration-200"
          )}
        >
          <Icon className={cn("w-4 h-4 md:w-5 md:h-5", config.color)} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
            <span className="text-xs md:text-sm font-semibold text-[hsl(var(--fg-primary))] truncate">
              {summary.label}
            </span>
            {hasUnread && (
              <span
                className="shrink-0 w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-[hsl(var(--color-destructive))]"
                aria-label={t("entity.activity.unread")}
              />
            )}
            {!compact && (
              <span className="text-[9px] md:text-[10px] text-[hsl(var(--fg-tertiary))] font-medium shrink-0">
                {config.label}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 md:gap-2 mt-0.5 flex-wrap">
            {summary.subtitle && (
              <span className="text-[10px] md:text-xs text-[hsl(var(--fg-secondary))] flex items-center gap-1">
                <User className="w-2.5 h-2.5 md:w-3 md:h-3 shrink-0" aria-hidden="true" />
                <span className="truncate max-w-[120px] md:max-w-none">{summary.subtitle}</span>
              </span>
            )}
            {summary.amount !== undefined && (
              <span className="text-[10px] md:text-xs font-semibold text-[hsl(var(--fg-primary))] flex items-center gap-1 shrink-0">
                <DollarSign className="w-2.5 h-2.5 md:w-3 md:h-3" aria-hidden="true" />
                {formatCurrency(summary.amount, summary.currency || "AFN")}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 md:gap-2 mt-0.5 md:mt-1 flex-wrap">
            {summary.status && <StatusBadge status={summary.status} />}
            <span className="text-[9px] md:text-[10px] text-[hsl(var(--fg-tertiary))] flex items-center gap-1 shrink-0">
              <Clock className="w-2.5 h-2.5 md:w-3 md:h-3" aria-hidden="true" />
              {compact ? summary.activityCount : t("entity.activity.count", { count: summary.activityCount })}
            </span>
            {timeAgoText && (
              <>
                <span className="text-[9px] md:text-[10px] text-[hsl(var(--fg-tertiary))]" aria-hidden="true">
                  •
                </span>
                <span className="text-[9px] md:text-[10px] text-[hsl(var(--fg-tertiary))] shrink-0">
                  {timeAgoText}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Chevron */}
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 md:w-4 md:h-4 shrink-0 text-[hsl(var(--fg-tertiary))] transition-transform duration-200 mt-1",
            isOpen && "rotate-180",
            "group-hover:text-[hsl(var(--fg-primary))]"
          )}
          aria-hidden="true"
        />
      </div>
    </button>
  );
});
CardHeader.displayName = "CardHeader";

// ─── Main Component ─────────────────────────────────────────────────────────

export const EntityActivityCard = memo(function EntityActivityCard({
  entityType,
  entityId,
  entitySummary,
  activities,
  hasUnread,
  onActivityClick,
  onOpenEntity,
  compact = false,
  maxDisplayItems = 2,
}: EntityActivityCardProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  const handleShowMore = useCallback(() => {
    setIsOpen(true);
  }, []);

  const handleOpenEntity = useCallback(() => {
    if (onOpenEntity) {
      onOpenEntity(entityId, entityType);
    }
  }, [onOpenEntity, entityId, entityType]);

  const timelineId = `timeline-${entityId || entityType}`;

  const getMaxDisplay = useCallback((): number | undefined => {
    if (isOpen) return undefined;
    if (compact) return maxDisplayItems;
    return undefined;
  }, [isOpen, compact, maxDisplayItems]);

  const maxDisplay = getMaxDisplay();
  const showMoreHandler = compact ? handleShowMore : undefined;

  return (
    <div
      className={cn(
        "rounded-xl border border-[hsl(var(--border-default))] overflow-hidden",
        "transition-all duration-200",
        hasUnread && "border-[hsl(var(--color-primary)/0.3)] shadow-sm shadow-[hsl(var(--color-primary)/0.05)]",
        "bg-[hsl(var(--surface-elevated))]"
      )}
    >
      <ActivityPreview
        preview={
          <div className="space-y-0.5 md:space-y-1 p-1.5 md:p-2">
            <p className="text-xs md:text-sm font-semibold text-[hsl(var(--fg-primary))] line-clamp-2">
              {entitySummary.label}
            </p>
            {entitySummary.subtitle && (
              <p className="text-[10px] md:text-xs text-[hsl(var(--fg-secondary))] line-clamp-2">
                {entitySummary.subtitle}
              </p>
            )}
            {entitySummary.amount !== undefined && (
              <p className="text-xs md:text-sm font-bold text-[hsl(var(--fg-primary))]">
                {formatCurrency(entitySummary.amount, entitySummary.currency || "AFN")}
              </p>
            )}
            <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
              {entitySummary.status && <StatusBadge status={entitySummary.status} />}
              <span className="text-[9px] md:text-[10px] text-[hsl(var(--fg-tertiary))]">
                {t("entity.activity.count", { count: entitySummary.activityCount })} فعالیت
              </span>
            </div>
          </div>
        }
        delay={300}
      >
        <CardHeader
          summary={entitySummary}
          entityType={entityType}
          entityId={entityId}
          hasUnread={hasUnread}
          compact={compact}
          isOpen={isOpen}
          onToggle={toggle}
        />
      </ActivityPreview>

      <div
        id={timelineId}
        role="region"
        aria-label={t("entity.activity.timeline", "Timeline of activities")}
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-in-out",
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <div
            className={cn(
              "px-2 md:px-3 pt-1 pb-2 md:pb-3 border-t border-[hsl(var(--border-default)/0.5)]",
              compact && "pb-1.5 md:pb-2"
            )}
          >
            <TimelineList
              activities={activities}
              {...(maxDisplay !== undefined && { maxDisplay })}
              onActivityClick={onActivityClick}
              {...(showMoreHandler !== undefined && { onShowMore: showMoreHandler })}
            />

            {!compact && onOpenEntity && activities.length > 0 && (
              <div className="mt-2 md:mt-3 pt-1.5 md:pt-2 border-t border-[hsl(var(--border-default)/0.5)]">
                <button
                  type="button"
                  onClick={handleOpenEntity}
                  className="w-full text-center text-[9px] md:text-[10px] font-medium text-[hsl(var(--color-primary))] hover:underline py-1 transition-colors"
                >
                  {t("activity.open", "باز کردن")} {entitySummary.label} →
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