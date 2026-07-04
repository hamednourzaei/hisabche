// packages/ui/src/components/ui/notification-bell.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiClient } from "@hisabche/api";

interface Notification {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
}

function getNotificationTitle(n: Notification): string {
  switch (n.event_type) {
    case "invoice.created": return "فاکتور جدید صادر شد";
    case "invoice.paid": return "فاکتور پرداخت شد";
    case "leave.requested": return "درخواست مرخصی جدید";
    case "leave.approved": return "مرخصی تأیید شد";
    case "task.completed": return "تسک تکمیل شد";
    case "member.invited": return "دعوت به فضای کاری";
    case "member.joined": return "عضو جدید پیوست";
    case "stock.low": return "هشدار کمبود موجودی";
    default: return "رویداد جدید";
  }
}

function getNotificationPath(n: Notification): string {
  switch (n.entity_type) {
    case "invoice": return `/invoices/${n.entity_id}`;
    case "employee": return `/hr/${n.entity_id}`;
    case "project": return `/projects/${n.entity_id}`;
    case "task": return `/projects/${n.entity_id}`;
    default: return "/dashboard";
  }
}

function timeAgo(dateStr: string): string {
  const diffMin = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diffMin < 1) return "همین الان";
  if (diffMin < 60) return `${diffMin} دقیقه پیش`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} ساعت پیش`;
  return `${Math.floor(diffHour / 24)} روز پیش`;
}

export function NotificationBell() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

const fetchNotifications = useCallback(async () => {
  try {
    const { data } = await apiClient.get("/api/audit/logs", {
      params: { limit: 5 },
    });
    if (data?.data) {
      setNotifications(data.data.slice(0, 5));
      setUnreadCount(data.data.length > 0 ? Math.min(data.data.length, 3) : 0);
    }
  } catch {
    // Silent
  }
}, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleClick = (n: Notification) => {
    setOpen(false);
    router.push(getNotificationPath(n));
  };

  return (
    <div className="relative">
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
      >
        <Bell className="size-5" />
        {unreadCount > 0 && (
          <span className={cn(
            "absolute -top-0.5 -end-0.5",
            "flex items-center justify-center",
            "min-w-[18px] h-[18px] px-1",
            "text-[10px] font-bold text-white",
            "bg-[hsl(var(--color-destructive))]",
            "rounded-full",
          )}>
            {unreadCount > 9 ? "۹+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className={cn(
            "absolute end-0 top-full mt-2 z-50",
            "w-80 max-h-96 overflow-y-auto",
            "rounded-2xl",
            "border border-[hsl(var(--border-default))]",
            "bg-[hsl(var(--surface-elevated))]",
            "shadow-lg",
            "p-2",
          )}>
            <div className="flex items-center justify-between px-3 py-2">
              <h3 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">اعلان‌ها</h3>
              {unreadCount > 0 && (
                <span className="text-xs text-[hsl(var(--color-primary))]">{unreadCount} جدید</span>
              )}
            </div>
            {notifications.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-[hsl(var(--fg-tertiary))]">اعلانی وجود ندارد</p>
            ) : (
              <div className="space-y-1">
                {notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={cn(
                      "w-full text-start px-3 py-2.5 rounded-xl",
                      "hover:bg-[hsl(var(--surface-muted))]",
                      "transition-colors duration-100",
                    )}
                  >
                    <p className="text-sm font-medium text-[hsl(var(--fg-primary))] line-clamp-1">
                      {getNotificationTitle(n)}
                    </p>
                    <p className="text-xs text-[hsl(var(--fg-tertiary))] mt-0.5">
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