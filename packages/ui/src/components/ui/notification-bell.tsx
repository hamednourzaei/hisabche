// packages/ui/src/components/ui/notification-bell.tsx
"use client";

import { useState, useEffect, useCallback, useRef, useMemo, memo } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  Bell,
  X,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  CheckCheck,
  Inbox,
  ArrowLeft,
  FileText,
  User,
  DollarSign,
  Clock,
  Package,
  Users,
  Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useNotifications,
  useUnreadCount,
  useMarkAsRead,
  useMarkAllAsRead,
} from "@hisabche/api";
import type { Notification } from "@hisabche/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NotificationGroup {
  key: string;
  entityId: string;
  entityType: "invoice" | "customer" | "product" | "payment" | "supplier" | "inventory";
  entityLabel: string;
  entityUrl: string;
  items: Notification[];
  hasUnread: boolean;
  unreadCount: number;
  latestAt: string;
  // ✅ همه فیلدها را `| undefined` می‌کنیم
  invoiceNumber?: string | undefined;
  customerName?: string | undefined;
  total?: number | undefined;
  currency?: string | undefined;
  status?: string | undefined;
  summary?: {
    title: string;
    icon: any;
    color: string;
  };
}

interface NotificationBellProps {
  className?: string;
}

// ─── Per-entity type config ──────────────────────────────────────────────────

const entityConfig: Record<NotificationGroup["entityType"], { icon: any; color: string; bg: string }> = {
  invoice: { icon: FileText, color: "text-blue-500", bg: "bg-blue-500/10" },
  customer: { icon: Users, color: "text-purple-500", bg: "bg-purple-500/10" },
  product: { icon: Package, color: "text-amber-500", bg: "bg-amber-500/10" },
  payment: { icon: Receipt, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  supplier: { icon: Users, color: "text-orange-500", bg: "bg-orange-500/10" },
  inventory: { icon: Package, color: "text-rose-500", bg: "bg-rose-500/10" },
};

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(d: string, t: (key: string, fallback: string) => string): string {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return t("time.justNow", "همین الان");
  if (m < 60) return t("time.minutesAgo", `${m} دقیقه پیش`);
  const h = Math.floor(m / 60);
  if (h < 24) return t("time.hoursAgo", `${h} ساعت پیش`);
  const d2 = Math.floor(h / 24);
  if (d2 < 7) return t("time.daysAgo", `${d2} روز پیش`);
  const w = Math.floor(d2 / 7);
  if (w < 4) return t("time.weeksAgo", `${w} هفته پیش`);
  return t("time.monthsAgo", `${Math.floor(d2 / 30)} ماه پیش`);
}

function resolveEntityUrl(n: Notification): string {
  if (n.action_url) return n.action_url;
  if (n.entity_type === "invoice" && n.entity_id) return `/invoices/${n.entity_id}`;
  if (n.entity_type === "customer" && n.entity_id) return `/customers/${n.entity_id}`;
  if (n.entity_type === "product" && n.entity_id) return `/warehouse/${n.entity_id}`;
  if (n.entity_type === "payment" && n.entity_id) return `/payments/${n.entity_id}`;
  return "/dashboard";
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("fa-AF", {
    style: "currency",
    currency: currency || "AFN",
    maximumFractionDigits: 0,
  }).format(amount);
}

// ─── Group Notifications by Entity ─────────────────────────────────────────

function groupNotifications(list: Notification[]): NotificationGroup[] {
  if (!list || !Array.isArray(list) || list.length === 0) return [];

  const map = new Map<string, Notification[]>();
  for (const n of list) {
    const key = n.entity_type && n.entity_id ? `${n.entity_type}:${n.entity_id}` : n.id;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(n);
  }

  return Array.from(map.entries())
    .map(([key, items]) => {
      const sorted = items.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const latest = sorted[0];
      const metadata = latest?.metadata || {};

      if (!latest) {
        return {
          key,
          entityId: "",
          entityType: "invoice" as const,
          entityLabel: "بدون عنوان",
          entityUrl: "/dashboard",
          items: sorted,
          hasUnread: sorted.some((i) => !i.is_read),
          unreadCount: sorted.filter((i) => !i.is_read).length,
          latestAt: "",
        };
      }

      const entityType = (latest.entity_type as NotificationGroup["entityType"]) || "invoice";
      const config = entityConfig[entityType] || entityConfig.invoice;

      return {
        key,
        entityId: latest.entity_id || "",
        entityType,
        entityLabel: metadata?.invoice_number
          ? `فاکتور #${metadata.invoice_number}`
          : latest.title || "بدون عنوان",
        entityUrl: resolveEntityUrl(latest),
        items: sorted,
        hasUnread: sorted.some((i) => !i.is_read),
        unreadCount: sorted.filter((i) => !i.is_read).length,
        latestAt: latest.created_at || "",
        invoiceNumber: metadata?.invoice_number,
        customerName: metadata?.customer_name,
        total: metadata?.total,
        currency: metadata?.currency,
        status: metadata?.status,
        summary: {
          title: latest.title || "فعالیت جدید",
          icon: config.icon,
          color: config.color,
        },
      };
    })
    .sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime());
}

// ─── Sub-components ─────────────────────────────────────────────────────────

const EntityIcon = memo(function EntityIcon({
  type,
  size = "md",
}: {
  type: NotificationGroup["entityType"];
  size?: "sm" | "md";
}) {
  const config = entityConfig[type] || entityConfig.invoice;
  const Icon = config.icon;
  const dim = size === "md" ? "w-10 h-10" : "w-8 h-8";
  const iconDim = size === "md" ? "w-5 h-5" : "w-4 h-4";

  return (
    <div className={cn("flex shrink-0 items-center justify-center rounded-full", dim, config.bg)}>
      <Icon className={cn(iconDim, config.color)} aria-hidden="true" />
    </div>
  );
});
EntityIcon.displayName = "EntityIcon";

// ─── Timeline Item ──────────────────────────────────────────────────────────

const TimelineItem = memo(function TimelineItem({
  notification,
  isLast,
}: {
  notification: Notification;
  isLast: boolean;
}) {
  const config = entityConfig[notification.entity_type as NotificationGroup["entityType"]] || entityConfig.invoice;
  const Icon = config.icon;

  return (
    <div className="flex items-start gap-3">
      <div className="flex flex-col items-center">
        <div className={cn("w-6 h-6 rounded-full flex items-center justify-center", config.bg)}>
          <Icon className={cn("w-3.5 h-3.5", config.color)} aria-hidden="true" />
        </div>
        {!isLast && <div className="w-px h-4 bg-[hsl(var(--border-default))]" />}
      </div>
      <div className="flex-1 min-w-0 pb-3">
        <p className="text-sm text-[hsl(var(--fg-primary))]">{notification.title}</p>
        {notification.body && (
          <p className="text-xs text-[hsl(var(--fg-secondary))] mt-0.5">{notification.body}</p>
        )}
        <p className="text-[10px] text-[hsl(var(--fg-tertiary))] mt-1">
          {timeAgo(notification.created_at, (key) => key)}
        </p>
      </div>
    </div>
  );
});
TimelineItem.displayName = "TimelineItem";

// ─── Group Card ─────────────────────────────────────────────────────────────

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
  const statusColor = group.status ? statusColors[group.status] || "" : "";
  const statusLabel = group.status ? statusLabels[group.status] || group.status : "";
  const config = entityConfig[group.entityType] || entityConfig.invoice;
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "w-full rounded-xl border border-[hsl(var(--border-default))] overflow-hidden transition-all duration-200",
        group.hasUnread && "border-[hsl(var(--color-primary)/0.3)] shadow-sm"
      )}
    >
      {/* ─── Header ─────────────────────────────────────────── */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-start p-3 hover:bg-[hsl(var(--surface-muted))] transition-colors duration-150"
      >
        <div className="flex items-start gap-3">
          <EntityIcon type={group.entityType} size="md" />

          <div className="flex-1 min-w-0">
            {/* Entity Label */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[hsl(var(--fg-primary))] truncate">
                {group.entityLabel}
              </span>
              {group.hasUnread && (
                <span className="shrink-0 w-2 h-2 rounded-full bg-[hsl(var(--color-destructive))]" />
              )}
            </div>

            {/* Customer & Amount */}
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {group.customerName && (
                <span className="text-xs text-[hsl(var(--fg-secondary))] flex items-center gap-1 min-w-0">
                  <User className="w-3 h-3 shrink-0" aria-hidden="true" />
                  <span className="truncate">{group.customerName}</span>
                </span>
              )}
              {group.total !== undefined && (
                <span className="text-xs font-semibold text-[hsl(var(--fg-primary))] flex items-center gap-1 shrink-0">
                  <DollarSign className="w-3 h-3" aria-hidden="true" />
                  {formatCurrency(group.total, group.currency || "AFN")}
                </span>
              )}
            </div>

            {/* Status & Count */}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {group.status && (
                <span
                  className={cn(
                    "text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0",
                    statusColor
                  )}
                >
                  {statusLabel}
                </span>
              )}
              <span className="text-[10px] text-[hsl(var(--fg-tertiary))] flex items-center gap-1 shrink-0">
                <Clock className="w-3 h-3" aria-hidden="true" />
                {group.items.length} فعالیت • {timeAgo(group.latestAt, t)}
              </span>
            </div>
          </div>

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
            <div className="space-y-2">
              {group.items.map((n, index) => (
                <button
                  key={n.id}
                  onClick={() => onItemClick(n)}
                  className="w-full text-start"
                >
                  <TimelineItem
                    notification={n}
                    isLast={index === group.items.length - 1}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
GroupCard.displayName = "GroupCard";

// ─── Skeleton ───────────────────────────────────────────────────────────────

const BellSkeleton = memo(function BellSkeleton() {
  return (
    <div className="space-y-2 p-2">
      {[0, 1].map((i) => (
        <div key={i} className="p-3 border border-[hsl(var(--border-default))] rounded-xl">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-[hsl(var(--surface-muted))] animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-[hsl(var(--surface-muted))] rounded w-3/4 animate-pulse" />
              <div className="h-3 bg-[hsl(var(--surface-muted))] rounded w-1/2 animate-pulse" />
              <div className="h-3 bg-[hsl(var(--surface-muted))] rounded w-1/3 animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});
BellSkeleton.displayName = "BellSkeleton";

// ─── Empty State ────────────────────────────────────────────────────────────

const BellEmptyState = memo(function BellEmptyState({
  t,
}: {
  t: (key: string, fallback: string) => string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-[hsl(var(--surface-muted))] flex items-center justify-center mb-4">
        <Inbox className="w-8 h-8 text-[hsl(var(--fg-tertiary))]" aria-hidden="true" />
      </div>
      <h4 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
        {t("notifications.empty", "همه چیز مرتب است")}
      </h4>
      <p className="text-sm text-[hsl(var(--fg-tertiary))] mt-1">
        {t("notifications.emptyHint", "اعلان جدیدی ندارید.")}
      </p>
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

  const groups = useMemo(() => groupNotifications(notifications), [notifications]);

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

  // جلوگیری از اسکرول پس‌زمینه وقتی پنل روی موبایل باز است
  useEffect(() => {
    if (!open) return;
    const isMobile = window.matchMedia("(max-width: 639px)").matches;
    if (!isMobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

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
    router.push("/activities");
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
          "focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))] focus-visible:outline-none"
        )}
        aria-label={t("notifications.bell", "اعلان‌ها")}
        aria-expanded={open}
      >
        <Bell className="size-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -end-1 flex items-center justify-center min-w-[20px] h-[20px] px-1 text-[11px] font-bold text-white bg-[hsl(var(--color-destructive))] rounded-full shadow-sm shadow-[hsl(var(--color-destructive)/0.4)]">
            {unreadCount > 99 ? "۹۹+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* بک‌دراپ فقط روی موبایل، برای تمرکز روی پنل و بستن با کلیک بیرون */}
          <div
            className="fixed inset-0 z-40 bg-black/30 sm:hidden"
            aria-hidden="true"
            onClick={close}
          />

          <div
            ref={panelRef}
            role="dialog"
            aria-label={t("notifications.title", "مرکز فعالیت‌ها")}
            dir="rtl"
            className={cn(
              // موبایل: پنل ثابت، عرض کامل با حاشیه، وسط صفحه (بدون گرایش به چپ/راست)
              "fixed left-3 right-3 top-16 z-50",
              // دسکتاپ: رفتار قبلی، چسبیده به دکمه زنگ با عرض ثابت
              "sm:absolute sm:left-auto sm:right-auto sm:end-0 sm:top-full sm:mt-2",
              "w-auto sm:w-[400px] max-w-full max-h-[70vh] sm:max-h-[480px] flex flex-col",
              "rounded-2xl border border-[hsl(var(--border-default))]",
              "bg-[hsl(var(--surface-elevated))] shadow-2xl shadow-black/20",
              "animate-in fade-in-0 slide-in-from-top-2 duration-200"
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[hsl(var(--border-default))]">
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
                  {t("notifications.title", "مرکز فعالیت‌ها")}
                </h3>
                {unreadCount > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[hsl(var(--color-destructive)/0.1)] text-[hsl(var(--color-destructive))]">
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
                    <CheckCheck className="size-3.5" />
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
            <div className="overflow-y-auto overflow-x-hidden flex-1 p-3 min-w-0">
              {isLoading ? (
                <BellSkeleton />
              ) : groups.length === 0 ? (
                <BellEmptyState t={t} />
              ) : (
                <div className="space-y-2">
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
                  "flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-medium",
                  "text-[hsl(var(--fg-secondary))] hover:text-[hsl(var(--color-primary))]",
                  "border-t border-[hsl(var(--border-default))]",
                  "hover:bg-[hsl(var(--surface-muted))] transition-colors duration-150"
                )}
              >
                {t("notifications.viewAll", "مشاهده همه فعالیت‌ها")}
                <ArrowLeft className="size-3.5 rtl:rotate-180" />
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
});

NotificationBell.displayName = "NotificationBell";