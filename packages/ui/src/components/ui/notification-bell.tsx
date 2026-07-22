// packages/ui/src/components/ui/notification-bell.tsx
"use client";

import { useState, useEffect, useCallback, useRef, useMemo, memo } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  Bell,
  X,
  ChevronDown,
  Info,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  CheckCheck,
  Inbox,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useNotifications,
  useUnreadCount,
  useMarkAsRead,
  useMarkAllAsRead,
} from "@hisabche/api";
import type { Notification } from "@hisabche/api";

/* ═══════════════════════════════════════════════════════════════════════════
   NotificationBell v2 — Redesigned
   ✅ آیکون رنگی هر نوع · هیرارشی اطلاعات · Skeleton · Empty State طراحی‌شده
   ✅ Unread Indicator · Mark All Read · Group Header با شمارش · Hover Effects
   ✅ Badge System · لینک مشاهده همه
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── Types ────────────────────────────────────────────────────────────────────

interface NotificationGroup {
  key: string;
  entityLabel: string;
  entityUrl: string;
  items: Notification[];
  hasUnread: boolean;
  unreadCount: number;
  dominantType: Notification["type"];
  latestAt: string;
}

interface NotificationBellProps {
  className?: string;
}

// ─── Per-type visual language ───────────────────────────────────────────────
// هر نوع اعلان آیکون، رنگ و پس‌زمینه‌ی مخصوص خودش را دارد

const typeConfig = {
  info: {
    icon: Info,
    text: "text-[hsl(var(--color-info,210_80%_55%))]",
    bg: "bg-[hsl(var(--color-info,210_80%_55%)/0.12)]",
    border: "border-s-[hsl(var(--color-info,210_80%_55%))]",
  },
  success: {
    icon: CheckCircle2,
    text: "text-[hsl(var(--color-success))]",
    bg: "bg-[hsl(var(--color-success)/0.12)]",
    border: "border-s-[hsl(var(--color-success))]",
  },
  warning: {
    icon: AlertTriangle,
    text: "text-[hsl(var(--color-warning))]",
    bg: "bg-[hsl(var(--color-warning)/0.12)]",
    border: "border-s-[hsl(var(--color-warning))]",
  },
  approval_required: {
    icon: ShieldCheck,
    text: "text-[hsl(var(--color-primary))]",
    bg: "bg-[hsl(var(--color-primary)/0.12)]",
    border: "border-s-[hsl(var(--color-primary))]",
  },
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(d: string, t: (key: string, fallback: string) => string): string {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return t("time.justNow", "همین الان");
  if (m < 60) return t("time.minutesAgo", `${m} دقیقه پیش`).replace("{m}", String(m));
  const h = Math.floor(m / 60);
  if (h < 24) return t("time.hoursAgo", `${h} ساعت پیش`).replace("{h}", String(h));
  return t("time.daysAgo", `${Math.floor(h / 24)} روز پیش`).replace("{d}", String(Math.floor(h / 24)));
}

function resolveEntityUrl(n: Notification): string {
  if (n.action_url) return n.action_url;
  if (n.entity_type === "invoice" && n.entity_id) return `/invoices/${n.entity_id}`;
  return "/dashboard";
}

function groupNotifications(list: Notification[]): NotificationGroup[] {
  if (!list || !Array.isArray(list) || list.length === 0) {
    return [];
  }

  const m = new Map<string, Notification[]>();
  for (const n of list) {
    const k = n.entity_type && n.entity_id ? `${n.entity_type}:${n.entity_id}` : n.id;
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(n);
  }

  return Array.from(m.entries())
    .map(([key, items]) => {
      const unreadItems = items.filter((i) => !i.is_read);
      return {
        key,
        entityLabel: items[0]!.title,
        entityUrl: resolveEntityUrl(items[0]!),
        items,
        hasUnread: unreadItems.length > 0,
        unreadCount: unreadItems.length,
        dominantType: (unreadItems[0] ?? items[0])!.type,
        latestAt: items[0]!.created_at,
      };
    })
    .sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime());
}

// ─── TypeIcon (شارِد بین گروه و آیتم) ───────────────────────────────────────

const TypeIcon = memo(function TypeIcon({
  type,
  size = "sm",
}: {
  type: Notification["type"];
  size?: "sm" | "md";
}) {
  const config = typeConfig[type] ?? typeConfig.info;
  const Icon = config.icon;
  const dim = size === "md" ? "size-8" : "size-6";
  const iconDim = size === "md" ? "size-4" : "size-3.5";

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full",
        dim,
        config.bg
      )}
    >
      <Icon className={cn(iconDim, config.text)} aria-hidden="true" />
    </div>
  );
});
TypeIcon.displayName = "TypeIcon";

// ─── NotificationRow ─────────────────────────────────────────────────────────
// هیرارشی: عنوان ← توضیحات ← زمان، با نشانگر خوانده‌نشده

const NotificationRow = memo(function NotificationRow({
  n,
  onClick,
  t,
}: {
  n: Notification;
  onClick: (n: Notification) => void;
  t: (key: string, fallback: string) => string;
}) {
  const config = typeConfig[n.type] ?? typeConfig.info;
  const handleClick = useCallback(() => onClick(n), [onClick, n]);

  return (
    <button
      onClick={handleClick}
      className={cn(
        "w-full text-start px-3 py-2.5 rounded-lg border-s-2 flex items-start gap-2.5",
        "transition-all duration-150",
        "hover:bg-[hsl(var(--surface-muted))] active:scale-[0.99]",
        "motion-reduce:transition-none motion-reduce:active:scale-100",
        n.is_read ? "border-s-transparent opacity-60" : config.border
      )}
    >
      {!n.is_read && (
        <span
          className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[hsl(var(--color-destructive))]"
          aria-hidden="true"
        />
      )}
      <div className={cn("min-w-0 flex-1", n.is_read && "ps-[10px]")}>
        <p className="text-sm font-medium text-[hsl(var(--fg-primary))] line-clamp-1">
          {n.title}
        </p>
        {n.body && (
          <p className="text-xs text-[hsl(var(--fg-secondary))] mt-0.5 line-clamp-2">
            {n.body}
          </p>
        )}
        <p className="text-[11px] text-[hsl(var(--fg-tertiary))] mt-1 tabular-nums">
          {timeAgo(n.created_at, t)}
        </p>
      </div>
    </button>
  );
});
NotificationRow.displayName = "NotificationRow";

// ─── GroupCard ──────────────────────────────────────────────────────────────

const GroupCard = memo(function GroupCard({
  group,
  isOpen,
  onToggle,
  onItemClick,
  t,
}: {
  group: NotificationGroup;
  isOpen: boolean;
  onToggle: () => void;
  onItemClick: (n: Notification) => void;
  t: (key: string, fallback: string) => string;
}) {
  return (
    <div className="rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg",
          "transition-colors duration-150",
          "hover:bg-[hsl(var(--surface-muted))]"
        )}
      >
        <TypeIcon type={group.dominantType} size="md" />

        <span className="flex-1 min-w-0 text-start">
          <span className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-[hsl(var(--fg-primary))] truncate">
              {group.entityLabel}
            </span>
            {group.items.length > 1 && (
              <span className="shrink-0 text-[10px] font-bold tabular-nums rounded-full px-1.5 py-0.5 bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-tertiary))]">
                {group.items.length}
              </span>
            )}
          </span>
          <span className="block text-[11px] text-[hsl(var(--fg-tertiary))] mt-0.5">
            {group.hasUnread
              ? t("notifications.unreadInGroup", `${group.unreadCount} خوانده‌نشده`).replace(
                  "{n}",
                  String(group.unreadCount)
                )
              : t("notifications.allRead", "همه خوانده شده")}
          </span>
        </span>

        {group.hasUnread && (
          <span className="shrink-0 size-2 rounded-full bg-[hsl(var(--color-destructive))]" />
        )}

        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-[hsl(var(--fg-tertiary))] transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <div className="space-y-0.5 pt-0.5 ps-1">
            {group.items.map((n) => (
              <NotificationRow key={n.id} n={n} onClick={onItemClick} t={t} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});
GroupCard.displayName = "GroupCard";

// ─── Skeleton (به‌جای Spinner) ──────────────────────────────────────────────

const BellSkeleton = memo(function BellSkeleton() {
  return (
    <div className="space-y-2 px-1 py-1" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-2.5 px-2.5 py-2">
          <div className="size-8 shrink-0 rounded-full bg-[hsl(var(--surface-muted))] animate-pulse" />
          <div className="flex-1 space-y-1.5">
            <div
              className="h-3.5 rounded bg-[hsl(var(--surface-muted))] animate-pulse"
              style={{ width: `${65 - i * 10}%` }}
            />
            <div
              className="h-2.5 rounded bg-[hsl(var(--surface-muted))] animate-pulse"
              style={{ width: `${40 - i * 5}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
});
BellSkeleton.displayName = "BellSkeleton";

// ─── EmptyState ──────────────────────────────────────────────────────────────

const BellEmptyState = memo(function BellEmptyState({
  t,
}: {
  t: (key: string, fallback: string) => string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2.5 px-4 py-10 text-center">
      <div className="flex size-11 items-center justify-center rounded-2xl bg-[hsl(var(--surface-muted))]">
        <Inbox className="size-5 text-[hsl(var(--fg-tertiary))]" aria-hidden="true" />
      </div>
      <div className="space-y-0.5">
        <p className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
          {t("notifications.empty", "اعلانی وجود ندارد")}
        </p>
        <p className="text-xs text-[hsl(var(--fg-tertiary))]">
          {t("notifications.emptyHint", "به‌محض بروز رویداد جدید، اینجا نشان داده می‌شود")}
        </p>
      </div>
    </div>
  );
});
BellEmptyState.displayName = "BellEmptyState";

// ─── Main Component ─────────────────────────────────────────────────────────

export const NotificationBell = memo(function NotificationBell({
  className,
}: NotificationBellProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const { data: notifications = [], isLoading } = useNotifications();
  const { data: unreadCount = 0 } = useUnreadCount();
  const { mutate: markAsRead } = useMarkAsRead();
  const { mutate: markAllAsRead, isPending: isMarkingAll } = useMarkAllAsRead();

  const groups = useMemo(() => groupNotifications(notifications || []), [notifications]);

  const [tog, setTog] = useState<Record<string, boolean>>({});

  const isOpen = useCallback((g: NotificationGroup) => tog[g.key] ?? g.hasUnread, [tog]);

  const toggleFn = useCallback(
    (g: NotificationGroup) => setTog((p) => ({ ...p, [g.key]: !isOpen(g) })),
    [isOpen]
  );

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) close();
    };
    const timeout = setTimeout(() => document.addEventListener("mousedown", h), 0);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener("mousedown", h);
    };
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, close]);

  const click = useCallback(
    (n: Notification) => {
      if (!n.is_read) {
        markAsRead([n.id]);
      }
      setOpen(false);
      router.push(resolveEntityUrl(n));
    },
    [markAsRead, router]
  );

  const handleMarkAllAsRead = useCallback(() => {
    markAllAsRead();
  }, [markAllAsRead]);

  const handleViewAll = useCallback(() => {
    setOpen(false);
    router.push("/notifications");
  }, [router]);

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "relative p-2 rounded-xl text-[hsl(var(--fg-secondary))]",
          "hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]",
          "transition-colors duration-150",
          "focus-visible:ring-4 focus-visible:ring-[rgba(18,200,160,0.18)] focus-visible:outline-none"
        )}
        aria-label={t("notifications.bell", "اعلان‌ها")}
        aria-expanded={open}
      >
        <Bell className="size-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -end-1 flex items-center justify-center min-w-[20px] h-[20px] px-1 text-[11px] font-bold text-white bg-[hsl(var(--color-destructive))] rounded-full shadow-sm shadow-[hsl(var(--color-destructive)/0.4)] tabular-nums">
            {unreadCount > 99 ? t("notifications.many", "۹۹+") : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={t("notifications.title", "اعلان‌ها")}
          className={cn(
            "absolute end-0 top-full mt-2 z-50 w-80 max-h-[26rem] flex flex-col",
            "rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] shadow-lg",
            "animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-150"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-[hsl(var(--border-default))]">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
                {t("notifications.title", "اعلان‌ها")}
              </h3>
              {unreadCount > 0 && (
                <span className="shrink-0 text-[10px] font-bold tabular-nums rounded-full px-1.5 py-0.5 bg-[hsl(var(--color-destructive)/0.12)] text-[hsl(var(--color-destructive))]">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  disabled={isMarkingAll}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium",
                    "text-[hsl(var(--color-primary))] hover:bg-[hsl(var(--color-primary)/0.1)]",
                    "transition-colors disabled:opacity-40"
                  )}
                >
                  <CheckCheck className="size-3.5" aria-hidden="true" />
                  {t("notifications.markAllRead", "خواندن همه")}
                </button>
              )}
              <button
                type="button"
                onClick={close}
                className="p-1 rounded-lg text-[hsl(var(--fg-tertiary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))] transition-colors"
                aria-label={t("action.close", "بستن")}
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="overflow-y-auto flex-1 p-1.5">
            {isLoading ? (
              <BellSkeleton />
            ) : groups.length === 0 ? (
              <BellEmptyState t={t} />
            ) : (
              <div className="space-y-1">
                {groups.map((g) => (
                  <GroupCard
                    key={g.key}
                    group={g}
                    isOpen={isOpen(g)}
                    onToggle={() => toggleFn(g)}
                    onItemClick={click}
                    t={t}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {groups.length > 0 && (
            <button
              type="button"
              onClick={handleViewAll}
              className={cn(
                "flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium",
                "text-[hsl(var(--fg-secondary))] hover:text-[hsl(var(--color-primary))]",
                "border-t border-[hsl(var(--border-default))]",
                "hover:bg-[hsl(var(--surface-muted))] transition-colors duration-150"
              )}
            >
              {t("notifications.viewAll", "مشاهده همه اعلان‌ها")}
              <ArrowLeft className="size-3.5 rtl:rotate-180" aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </div>
  );
});

NotificationBell.displayName = "NotificationBell";