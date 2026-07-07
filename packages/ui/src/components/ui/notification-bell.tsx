"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Bell, X, ChevronDown } from "lucide-react";
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
      entityUrl: resolveEntityUrl(first),
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
const NOTIFICATIONS_LIMIT = 10;
const INITIAL_SYNC_LIMIT = 30; // ✅ Why: Cross-device hydration limit
const READ_CACHE_STORAGE_KEY = "hisabche_read_notifs_v1";
const MAX_CACHE_SIZE = 30;

/* ═══════════════════════════════════════════════════════════════
   PERSISTENT CACHE HELPERS
   ═══════════════════════════════════════════════════════════════ */

function hydrateReadCacheFromDisk(): Map<string, Notification> {
  if (typeof window === "undefined") return new Map();
  try {
    const raw = localStorage.getItem(READ_CACHE_STORAGE_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw) as Record<string, Notification>;
    return new Map(Object.entries(parsed));
  } catch {
    return new Map();
  }
}

function persistReadCacheToDisk(cache: Map<string, Notification>): void {
  if (typeof window === "undefined") return;
  try {
    const entries = Array.from(cache.entries()).slice(0, MAX_CACHE_SIZE);
    const obj = Object.fromEntries(entries);
    localStorage.setItem(READ_CACHE_STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // Storage full or unavailable
  }
}

/* ═══════════════════════════════════════════════════════════════
   HOOK — useNotifications
   ═══════════════════════════════════════════════════════════════ */

function useNotifications(apiBase: string) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const isMounted = useRef(true);
  
  const readCacheRef = useRef<Map<string, Notification>>(hydrateReadCacheFromDisk());

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

      // ✅ Why: If cache is empty (new device), fetch more to hydrate cross-device read state.
      // Once hydrated, subsequent polls use the smaller UI limit.
      const isCacheEmpty = readCacheRef.current.size === 0;
      const fetchLimit = isCacheEmpty ? INITIAL_SYNC_LIMIT : NOTIFICATIONS_LIMIT;

      const [notifRes, countRes] = await Promise.all([
        fetch(`${apiBase}/notifications?limit=${fetchLimit}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${apiBase}/notifications/unread-count`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (!isMounted.current) return;

      if (notifRes.ok) {
        const json = (await notifRes.json()) as { data?: Notification[] };
        const fetchedItems = json.data || [];

        // 1. Update cache with read items
        for (const item of fetchedItems) {
          if (item.is_read) {
            readCacheRef.current.set(item.id, item);
          }
        }

        // 2. Defensive Merge
        const mergedMap = new Map<string, Notification>();
        
        for (const item of fetchedItems) {
          mergedMap.set(item.id, item);
        }
        
        // Restore read items from persistent cache
        for (const [id, cachedItem] of readCacheRef.current.entries()) {
          if (!mergedMap.has(id)) {
            mergedMap.set(id, cachedItem);
          }
        }

        // 3. Sort and apply standard UI limit
        const finalList = Array.from(mergedMap.values())
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, NOTIFICATIONS_LIMIT);

        setNotifications(finalList);
      }

      if (countRes.ok) {
        const countJson = (await countRes.json()) as { count?: number };
        if (isMounted.current) setUnreadCount(countJson.count ?? 0);
      }
    } catch {
      // Production safe
    }
  }, [apiBase, getToken]);

  const markAsRead = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      try {
        const token = await getToken();
        if (!token) return;

        setNotifications((prev) => {
          const updated = prev.map((n) => (ids.includes(n.id) ? { ...n, is_read: true } : n));
          for (const n of updated) {
            if (n.is_read) readCacheRef.current.set(n.id, n);
          }
          persistReadCacheToDisk(readCacheRef.current);
          return updated;
        });

        await fetch(`${apiBase}/notifications/mark-read`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ids }),
        });

        const countRes = await fetch(`${apiBase}/notifications/unread-count`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (countRes.ok) {
          const json = (await countRes.json()) as { count?: number };
          if (isMounted.current) setUnreadCount(json.count ?? 0);
        }
      } catch {
        // Production safe
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
   SUB-COMPONENT — NotificationGroupCard (کشویی)
   ═══════════════════════════════════════════════════════════════ */

function NotificationGroupCard({
  group,
  isOpen,
  onToggle,
  onItemClick,
}: {
  group: NotificationGroup;
  isOpen: boolean;
  onToggle: () => void;
  onItemClick: (n: Notification) => void;
}) {
  const panelId = `notif-group-${group.key}`;

  return (
    <div className="rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className={cn(
          "w-full flex items-center justify-between px-3 py-1.5 rounded-lg",
          "hover:bg-[hsl(var(--surface-muted))] transition-colors duration-100",
        )}
      >
        <span className="flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--fg-secondary))]">
          {group.hasUnread && (
            <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--color-destructive))] shrink-0" />
          )}
          {group.entityLabel}
        </span>
        <span className="flex items-center gap-1.5">
          {group.items.length > 1 && (
            <span className="text-[10px] text-[hsl(var(--fg-tertiary))]">
              {group.items.length} رویداد
            </span>
          )}
          <ChevronDown
            className={cn(
              "size-3.5 text-[hsl(var(--fg-tertiary))] transition-transform duration-200",
              isOpen && "rotate-180",
            )}
          />
        </span>
      </button>

      <div
        id={panelId}
        role="region"
        aria-labelledby={panelId}
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="space-y-0.5 pt-0.5">
            {group.items.map((n) => (
              <button
                key={n.id}
                onClick={() => onItemClick(n)}
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
      </div>
    </div>
  );
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

  const [manualToggle, setManualToggle] = useState<Record<string, boolean>>({});

  const isGroupOpen = useCallback(
    (group: NotificationGroup) => manualToggle[group.key] ?? group.hasUnread,
    [manualToggle],
  );

  const toggleGroup = useCallback(
    (group: NotificationGroup) => {
      setManualToggle((prev) => ({ ...prev, [group.key]: !isGroupOpen(group) }));
    },
    [isGroupOpen],
  );

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
            <div className="space-y-1 mt-1">
              {groups.map((group) => (
                <NotificationGroupCard
                  key={group.key}
                  group={group}
                  isOpen={isGroupOpen(group)}
                  onToggle={() => toggleGroup(group)}
                  onItemClick={handleGroupItemClick}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}