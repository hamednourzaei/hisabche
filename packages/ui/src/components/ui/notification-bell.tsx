"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Bell, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabaseClient } from "@hisabche/auth";

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

interface Notification {
  id: string;
  title: string;
  body?: string | null;
  type: "info" | "success" | "warning" | "approval_required";
  action_url?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  entity_label?: string | null;
  actor_name?: string | null;
  is_read: boolean;
  created_at: string;
}

interface NotificationGroup {
  key: string;
  entityLabel: string;
  entityUrl: string | null;
  items: Notification[];
  hasUnread: boolean;
  latestType: Notification["type"];
}

interface NotificationBellProps {
  className?: string;
  apiBase?: string;
}

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */

function timeAgo(dateStr: string): string {
  const diffMin = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diffMin < 1) return "همین الان";
  if (diffMin < 60) return `${diffMin} دقیقه پیش`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} ساعت پیش`;
  return `${Math.floor(diffHour / 24)} روز پیش`;
}

const ENTITY_LABELS: Record<string, string> = {
  invoice: "فاکتور",
  employee: "کارمند",
  project: "پروژه",
  task: "تسک",
  workspace: "فضای کاری",
  leave: "مرخصی",
};

function resolveEntityLabel(n: Notification): string {
  if (n.entity_label) return n.entity_label;
  if (n.entity_type && n.entity_id) {
    const prefix = ENTITY_LABELS[n.entity_type] ?? n.entity_type;
    return `${prefix} #${n.entity_id.slice(0, 8)}`;
  }
  return n.title;
}

function resolveEntityUrl(n: Notification): string | null {
  if (n.action_url) return n.action_url;
  if (n.entity_type === "invoice" && n.entity_id) return `/invoices/${n.entity_id}`;
  if (n.entity_type === "employee" && n.entity_id) return `/hr/${n.entity_id}`;
  if (n.entity_type === "project" && n.entity_id) return `/projects/${n.entity_id}`;
  if (n.entity_type === "task" && n.entity_id) return `/projects/${n.entity_id}`;
  return null;
}

function pickGroupType(items: Notification[]): Notification["type"] {
  if (items.some((i) => i.type === "approval_required" && !i.is_read)) return "approval_required";
  return items[0]?.type ?? "info";
}

function groupNotifications(list: Notification[]): NotificationGroup[] {
  const map = new Map<string, Notification[]>();
  const order: string[] = [];

  for (const n of list) {
    const key =
      n.entity_type && n.entity_id ? `${n.entity_type}:${n.entity_id}` : `single:${n.id}`;
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(n);
  }

  return order.map((key) => {
    
    const items = map
      .get(key)!
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const first = items[0]!;

    return {
      key,
      entityLabel: resolveEntityLabel(first),
      entityUrl: resolveEntityLabel(first),
      items,
      hasUnread: items.some((i) => !i.is_read),
      latestType: pickGroupType(items),
    };
  });
}

const typeStyles: Record<string, string> = {
  info: "border-s-[hsl(var(--color-info))]",
  success: "border-s-[hsl(var(--color-success))]",
  warning: "border-s-[hsl(var(--color-warning))]",
  approval_required: "border-s-[hsl(var(--color-primary))]",
};

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */

const DEFAULT_API_BASE = "https://hisabche.onrender.com/api/v1";
const POLL_INTERVAL_MS = 15_000;

/* ═══════════════════════════════════════════════════════════════
   HOOK — useNotifications
   ═══════════════════════════════════════════════════════════════ */

function useNotifications(apiBase: string) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const isMounted = useRef(true);

  const getToken = useCallback(async (): Promise<string | null> => {
    const { data } = await supabaseClient.auth.getSession();
    if (data.session?.access_token) return data.session.access_token;
    const { data: refreshed } = await supabaseClient.auth.refreshSession();
    return refreshed.session?.access_token ?? null;
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;

      const [notifRes, countRes] = await Promise.all([
        fetch(`${apiBase}/notifications?limit=5&is_read=false`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${apiBase}/notifications/unread-count`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (!isMounted.current) return;

      if (notifRes.ok) {
        const json = await notifRes.json();
        setNotifications(json.data || []);
      } else if (process.env.NODE_ENV === "development") {
        console.error("[NotificationBell] API error:", notifRes.status);
      }

      if (countRes.ok) {
        const json = await countRes.json();
        setUnreadCount(json.count ?? 0);
      }
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.error("[NotificationBell] Fetch error:", err);
      }
    }
  }, [apiBase, getToken]);

  const markAsRead = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      try {
        const token = await getToken();
        if (!token) return;

        // Optimistic UI update
        setNotifications((prev) =>
          prev.map((n) => (ids.includes(n.id) ? { ...n, is_read: true } : n)),
        );

        await fetch(`${apiBase}/notifications/mark-read`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ids }),
        });

        // Only refresh unread count — avoids flickering notification list
        const countRes = await fetch(`${apiBase}/notifications/unread-count`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (countRes.ok) {
          const json = await countRes.json();
          if (isMounted.current) setUnreadCount(json.count ?? 0);
        }
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          console.error("[NotificationBell] markAsRead error:", err);
        }
      }
    },
    [apiBase, getToken],
  );

  useEffect(() => {
    isMounted.current = true;
    fetchNotifications();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") fetchNotifications();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") fetchNotifications();
    }, POLL_INTERVAL_MS);

    return () => {
      isMounted.current = false;
      document.removeEventListener("visibilitychange", handleVisibility);
      clearInterval(interval);
    };
  }, [fetchNotifications]);

  return { notifications, unreadCount, refetch: fetchNotifications, markAsRead };
}

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export function NotificationBell({
  className,
  apiBase = DEFAULT_API_BASE,
}: NotificationBellProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const { notifications, unreadCount, refetch, markAsRead } = useNotifications(apiBase);

  const groups = useMemo(() => groupNotifications(notifications), [notifications]);

  const closePanel = useCallback(() => {
    setOpen(false);
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length > 0) markAsRead(unreadIds);
  }, [notifications, markAsRead]);

  useEffect(() => {
    if (open) refetch();
  }, [open, refetch]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current?.contains(e.target as Node)) return;
      closePanel();
    };
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open, closePanel]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePanel();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, closePanel]);

  const handleGroupItemClick = (n: Notification) => {
    closePanel();
    const url = resolveEntityUrl(n);
    router.push(url ?? "/dashboard");
  };

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "relative p-2 rounded-xl",
          "text-[hsl(var(--fg-secondary))]",
          "hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]",
          "transition-colors duration-150",
        )}
        aria-label="اعلان‌ها"
        aria-expanded={open}
      >
        <Bell className="size-5" />
        {unreadCount > 0 && (
          <span
            className={cn(
              "absolute -top-0.5 -end-0.5",
              "flex items-center justify-center",
              "min-w-[18px] h-[18px] px-1",
              "text-[10px] font-bold text-white",
              "bg-[hsl(var(--color-destructive))]",
              "rounded-full",
            )}
          >
            {unreadCount > 9 ? "۹+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className={cn(
            "absolute end-0 top-full mt-2 z-50",
            "w-80 max-h-96 overflow-y-auto",
            "rounded-2xl border border-[hsl(var(--border-default))]",
            "bg-[hsl(var(--surface-elevated))] shadow-lg p-2",
            "animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-150",
          )}
        >
          <div className="flex items-center justify-between px-3 py-2 mb-1 border-b border-[hsl(var(--border-default))]">
            <h3 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">اعلان‌ها</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <span className="text-xs font-medium text-[hsl(var(--color-primary))]">
                  {unreadCount} جدید
                </span>
              )}
              <button
                type="button"
                onClick={closePanel}
                className="p-1 rounded-lg text-[hsl(var(--fg-tertiary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))] transition-colors"
                aria-label="بستن پنل اعلان‌ها"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {groups.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-[hsl(var(--fg-tertiary))]">
              اعلانی وجود ندارد
            </p>
          ) : (
            <div className="space-y-2 mt-1">
              {groups.map((group) => (
                <div key={group.key} className="rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-3 pt-1.5 pb-1">
                    <span className="text-xs font-semibold text-[hsl(var(--fg-secondary))]">
                      {group.entityLabel}
                    </span>
                    {group.items.length > 1 && (
                      <span className="text-[10px] text-[hsl(var(--fg-tertiary))]">
                        {group.items.length} رویداد
                      </span>
                    )}
                  </div>

                  <div className="space-y-0.5">
                    {group.items.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => handleGroupItemClick(n)}
                        className={cn(
                          "w-full text-start px-3 py-2 rounded-lg border-s-2",
                          "hover:bg-[hsl(var(--surface-muted))]",
                          "transition-colors duration-100",
                          n.is_read
                            ? "border-s-transparent opacity-60"
                            : typeStyles[n.type] ?? typeStyles.info,
                        )}
                      >
                        <p className="text-sm font-medium text-[hsl(var(--fg-primary))] line-clamp-1">
                          {n.title}
                        </p>
                        {(n.body || n.actor_name) && (
                          <p className="text-xs text-[hsl(var(--fg-secondary))] mt-0.5 line-clamp-2">
                            {n.body}
                            {n.actor_name && (
                              <span className="text-[hsl(var(--fg-tertiary))]">
                                {" — "}
                                {n.actor_name}
                              </span>
                            )}
                          </p>
                        )}
                        <p className="text-xs text-[hsl(var(--fg-tertiary))] mt-1">
                          {timeAgo(n.created_at)}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}