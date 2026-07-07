// packages/ui/src/components/ui/notification-bell.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabaseClient } from "@hisabche/auth";

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

export function NotificationBell() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    try {
      const token = (await supabaseClient.auth.getSession()).data.session?.access_token;
      if (!token) {
        console.log("[NotificationBell] No token, skipping");
        return;
      }

      const base = "https://hisabche.onrender.com/api/v1";

      console.log("[NotificationBell] Fetching...");

      const [notifRes, countRes] = await Promise.all([
        fetch(`${base}/notifications?limit=5&is_read=false`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${base}/notifications/unread-count`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      console.log("[NotificationBell] notifRes status:", notifRes.status);
      console.log("[NotificationBell] countRes status:", countRes.status);

      if (notifRes.ok) {
        const json = await notifRes.json();
        console.log("[NotificationBell] Notifications:", json);
        setNotifications(json.data || []);
      } else {
        const errText = await notifRes.text();
        console.error("[NotificationBell] API error:", notifRes.status, errText);
      }

      if (countRes.ok) {
        const json = await countRes.json();
        console.log("[NotificationBell] Unread count:", json);
        setUnreadCount(json.count ?? 0);
      }
    } catch (err) {
      console.error("[NotificationBell] Fetch error:", err);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleClick = (n: Notification) => {
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
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          if (!open) fetchNotifications();
        }}
        className={cn(
          "relative p-2 rounded-xl",
          "text-[hsl(var(--fg-secondary))]",
          "hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]",
          "transition-colors duration-150",
        )}
        aria-label="اعلان‌ها"
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
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className={cn(
              "absolute end-0 top-full mt-2 z-50",
              "w-80 max-h-96 overflow-y-auto",
              "rounded-2xl",
              "border border-[hsl(var(--border-default))]",
              "bg-[hsl(var(--surface-elevated))]",
              "shadow-lg",
              "p-2",
            )}
          >
            <div className="flex items-center justify-between px-3 py-2">
              <h3 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
                اعلان‌ها
              </h3>
              {unreadCount > 0 && (
                <span className="text-xs text-[hsl(var(--color-primary))]">
                  {unreadCount} جدید
                </span>
              )}
            </div>

            {notifications.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-[hsl(var(--fg-tertiary))]">
                اعلانی وجود ندارد
              </p>
            ) : (
              <div className="space-y-1">
                {notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
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
        </>
      )}
    </div>
  );
}