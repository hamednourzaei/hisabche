"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  is_read: boolean;
  created_at: string;
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

  const fetchNotifications = useCallback(async () => {
    try {
      // ✅ Fix 1: Refresh session if token expired
      const { data: sessionData } = await supabaseClient.auth.getSession();
      if (!sessionData.session) {
        const { data: refreshed } = await supabaseClient.auth.refreshSession();
        if (!refreshed.session) return;
      }

      const token =
        sessionData.session?.access_token ||
        (await supabaseClient.auth.getSession()).data.session?.access_token;
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
        // ✅ Fix 2: Log errors in dev only
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
  }, [apiBase]);

  useEffect(() => {
    isMounted.current = true;
    fetchNotifications();

    // ✅ Fix 3: Pause polling when tab is hidden
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchNotifications();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchNotifications();
      }
    }, POLL_INTERVAL_MS);

    return () => {
      isMounted.current = false;
      document.removeEventListener("visibilitychange", handleVisibility);
      clearInterval(interval);
    };
  }, [fetchNotifications]);

  return { notifications, unreadCount, refetch: fetchNotifications };
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

  const { notifications, unreadCount, refetch } = useNotifications(apiBase);

  // Refetch when opening
  useEffect(() => {
    if (open) refetch();
  }, [open, refetch]);

  // Click outside
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  // Escape key
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  const handleItemClick = (n: Notification) => {
    setOpen(false);
    if (n.action_url) {
      router.push(n.action_url);
    } else if (n.entity_type === "invoice" && n.entity_id) {
      router.push(`/invoices/${n.entity_id}`);
    } else {
      router.push("/dashboard");
    }
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
            <h3 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
              اعلان‌ها
            </h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <span className="text-xs font-medium text-[hsl(var(--color-primary))]">
                  {unreadCount} جدید
                </span>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg text-[hsl(var(--fg-tertiary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))] transition-colors"
                aria-label="بستن پنل اعلان‌ها"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {notifications.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-[hsl(var(--fg-tertiary))]">
              اعلانی وجود ندارد
            </p>
          ) : (
            <div className="space-y-1 mt-1">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleItemClick(n)}
                  className={cn(
                    "w-full text-start px-3 py-2.5 rounded-xl border-s-2",
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
                  {n.body && (
                    <p className="text-xs text-[hsl(var(--fg-secondary))] mt-0.5 line-clamp-2">
                      {n.body}
                    </p>
                  )}
                  <p className="text-xs text-[hsl(var(--fg-tertiary))] mt-1">
                    {timeAgo(n.created_at)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}