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
  is_read: boolean;
  created_at: string;
}

interface NotificationGroup {
  key: string;
  entityLabel: string;
  entityUrl: string;
  items: Notification[];
  hasUnread: boolean;
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

function resolveEntityUrl(n: Notification): string {
  if (n.action_url) return n.action_url;
  if (n.entity_type === "invoice" && n.entity_id) return `/invoices/${n.entity_id}`;
  return "/dashboard";
}

function groupNotifications(list: Notification[]): NotificationGroup[] {
  const map = new Map<string, Notification[]>();
  for (const n of list) {
    const key = n.entity_type && n.entity_id ? `${n.entity_type}:${n.entity_id}` : n.id;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(n);
  }
  return Array.from(map.entries()).map(([key, items]) => ({
    key,
    entityLabel: items[0]!.title,
    entityUrl: resolveEntityUrl(items[0]!),
    items,
    hasUnread: items.some((i) => !i.is_read),
  }));
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

/* ═══════════════════════════════════════════════════════════════
   HOOK — API + Realtime (unread count only)
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
        fetch(`${apiBase}/notifications?limit=10`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${apiBase}/notifications/unread-count`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (!isMounted.current) return;
      if (notifRes.ok) {
        const json = (await notifRes.json()) as { data?: Notification[] };
        setNotifications(json.data || []);
      }
      if (countRes.ok) {
        const json = (await countRes.json()) as { count?: number };
        if (isMounted.current) setUnreadCount(json.count ?? 0);
      }
    } catch { /* silent */ }
  }, [apiBase, getToken]);

  const markAsRead = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    try {
      const token = await getToken();
      if (!token) return;
      setNotifications((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, is_read: true } : n)));
      await fetch(`${apiBase}/notifications/mark-read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const countRes = await fetch(`${apiBase}/notifications/unread-count`, { headers: { Authorization: `Bearer ${token}` } });
      if (countRes.ok) { const json = (await countRes.json()) as { count?: number }; if (isMounted.current) setUnreadCount(json.count ?? 0); }
    } catch { /* silent */ }
  }, [apiBase, getToken]);

  useEffect(() => {
    isMounted.current = true;
    fetchNotifications();

    // Realtime: فقط برای آپدیت unreadCount و INSERT جدید
    const channel = supabaseClient
      .channel("notifications-bell")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, () => {
        fetchNotifications();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notifications" }, () => {
        fetchNotifications();
      })
      .subscribe();

    const interval = setInterval(fetchNotifications, 30_000);

    return () => {
      isMounted.current = false;
      supabaseClient.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fetchNotifications]);

  return { notifications, unreadCount, markAsRead };
}

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export function NotificationBell({ className, apiBase = DEFAULT_API_BASE }: NotificationBellProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, markAsRead } = useNotifications(apiBase);
  const groups = useMemo(() => groupNotifications(notifications), [notifications]);
  const [manualToggle, setManualToggle] = useState<Record<string, boolean>>({});

  const isGroupOpen = useCallback((g: NotificationGroup) => manualToggle[g.key] ?? g.hasUnread, [manualToggle]);
  const toggleGroup = useCallback((g: NotificationGroup) => setManualToggle((p) => ({ ...p, [g.key]: !isGroupOpen(g) })), [isGroupOpen]);
  const closePanel = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!panelRef.current?.contains(e.target as Node)) closePanel(); };
    const t = setTimeout(() => document.addEventListener("mousedown", h), 0);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", h); };
  }, [open, closePanel]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") closePanel(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, closePanel]);

  const handleItemClick = useCallback((n: Notification) => {
    if (!n.is_read) markAsRead([n.id]);
    setOpen(false);
    router.push(resolveEntityUrl(n));
  }, [markAsRead, router]);

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-xl text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))] transition-colors duration-150"
        aria-label="اعلان‌ها"
      >
        <Bell className="size-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -end-1 flex items-center justify-center min-w-[20px] h-[20px] px-1 text-[11px] font-bold text-white bg-[hsl(var(--color-destructive))] rounded-full shadow-sm shadow-[hsl(var(--color-destructive)/0.4)]">
            {unreadCount > 99 ? "۹۹+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute end-0 top-full mt-2 z-50 w-80 max-h-96 overflow-y-auto rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] shadow-lg p-2 animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-150"
        >
          <div className="flex items-center justify-between px-3 py-2 mb-1 border-b border-[hsl(var(--border-default))]">
            <h3 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">اعلان‌ها</h3>
            <button type="button" onClick={closePanel} className="p-1 rounded-lg text-[hsl(var(--fg-tertiary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))] transition-colors" aria-label="بستن">
              <X className="size-4" />
            </button>
          </div>

          {groups.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-[hsl(var(--fg-tertiary))]">اعلانی وجود ندارد</p>
          ) : (
            <div className="space-y-1 mt-1">
              {groups.map((g) => (
                <NotificationGroupCard key={g.key} group={g} isOpen={isGroupOpen(g)} onToggle={() => toggleGroup(g)} onItemClick={handleItemClick} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NotificationGroupCard({
  group, isOpen, onToggle, onItemClick,
}: {
  group: NotificationGroup; isOpen: boolean; onToggle: () => void; onItemClick: (n: Notification) => void;
}) {
  return (
    <div className="rounded-xl overflow-hidden">
      <button type="button" onClick={onToggle} className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-[hsl(var(--surface-muted))] transition-colors duration-100">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--fg-secondary))]">
          {group.hasUnread && <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--color-destructive))] shrink-0" />}
          {group.entityLabel}
        </span>
        <ChevronDown className={cn("size-3.5 text-[hsl(var(--fg-tertiary))] transition-transform duration-200", isOpen && "rotate-180")} />
      </button>
      <div className={cn("grid transition-[grid-template-rows] duration-200 ease-out", isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="overflow-hidden">
          <div className="space-y-0.5 pt-0.5">
            {group.items.map((n) => (
              <button key={n.id} onClick={() => onItemClick(n)}
                className={cn("w-full text-start px-3 py-2 rounded-lg border-s-2 hover:bg-[hsl(var(--surface-muted))] transition-colors duration-100",
                  n.is_read ? "border-s-transparent opacity-60" : typeStyles[n.type] ?? typeStyles.info)}>
                <p className="text-sm font-medium text-[hsl(var(--fg-primary))] line-clamp-1">{n.title}</p>
                {n.body && <p className="text-xs text-[hsl(var(--fg-secondary))] mt-0.5 line-clamp-2">{n.body}</p>}
                <p className="text-xs text-[hsl(var(--fg-tertiary))] mt-1">{timeAgo(n.created_at)}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}