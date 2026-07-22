// packages/ui/src/components/ui/activity/ActivityItem.tsx
"use client";

import { memo, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  FileText,
  XCircle,
  Send,
  Archive,
  RefreshCw,
  DollarSign,
  Clock,
  User,
  Package,
  Receipt,
  Eye,
  MessageSquare,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActivityType =
  | "created"
  | "updated"
  | "status_changed"
  | "payment"
  | "approved"
  | "rejected"
  | "sent"
  | "archived"
  | "cancelled"
  | "viewed"
  | "commented";

export interface ActivityItemData {
  id: string;
  type: ActivityType;
  title: string;
  description?: string;
  timestamp: string;
  isRead?: boolean;
  actor?: string;
  metadata?: Record<string, unknown>;
}

// ✅ اصلاح تایپ: onClick را به‌عنوان optional با نوع صحیح
export interface ActivityItemProps {
  activity: ActivityItemData;
  isLast: boolean;
  onClick: (() => void) | undefined;  // ✅ explicit undefined
  className?: string;
  size?: "sm" | "md";
}

// ─── Activity Icons Config ──────────────────────────────────────────────────

const activityIcons: Record<ActivityType, { icon: any; color: string; bg: string }> = {
  created: { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  updated: { icon: FileText, color: "text-blue-500", bg: "bg-blue-500/10" },
  status_changed: { icon: RefreshCw, color: "text-amber-500", bg: "bg-amber-500/10" },
  payment: { icon: DollarSign, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  approved: { icon: ShieldCheck, color: "text-purple-500", bg: "bg-purple-500/10" },
  rejected: { icon: AlertTriangle, color: "text-red-500", bg: "bg-red-500/10" },
  sent: { icon: Send, color: "text-blue-500", bg: "bg-blue-500/10" },
  archived: { icon: Archive, color: "text-gray-500", bg: "bg-gray-500/10" },
  cancelled: { icon: XCircle, color: "text-red-500", bg: "bg-red-500/10" },
  viewed: { icon: Eye, color: "text-slate-500", bg: "bg-slate-500/10" },
  commented: { icon: MessageSquare, color: "text-indigo-500", bg: "bg-indigo-500/10" },
};

// ─── Main Component ─────────────────────────────────────────────────────────

export const ActivityItem = memo(function ActivityItem({
  activity,
  isLast,
  onClick,
  className,
  size = "md",
}: ActivityItemProps) {
  const config = activityIcons[activity.type] || activityIcons.created;
  const Icon = config.icon;
  const isSm = size === "sm";

  const formatTime = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleTimeString("fa-AF", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  // ✅ استفاده از useCallback برای handleClick
  const handleClick = useCallback(() => {
    if (onClick) {
      onClick();
    }
  }, [onClick]);

  return (
    <button
      onClick={handleClick}
      className={cn(
        "w-full text-start flex items-start gap-3 group rounded-lg transition-colors",
        "hover:bg-[hsl(var(--surface-muted))]",
        isSm ? "py-1 px-1" : "py-1.5 px-1",
        className
      )}
      disabled={!onClick}
      type="button"
    >
      {/* ─── Icon + Timeline Line ──────────────────────────────────────────── */}
      <div className="flex flex-col items-center shrink-0">
        <div
          className={cn(
            "rounded-full flex items-center justify-center transition-colors",
            isSm ? "w-5 h-5" : "w-6 h-6",
            "bg-[hsl(var(--surface-muted))] group-hover:bg-[hsl(var(--surface-muted)/0.8)]",
            config.bg
          )}
        >
          <Icon
            className={cn(
              isSm ? "w-3 h-3" : "w-3.5 h-3.5",
              config.color
            )}
          />
        </div>
        {!isLast && (
          <div
            className={cn(
              "w-px bg-[hsl(var(--border-default))]",
              isSm ? "h-3" : "h-4"
            )}
          />
        )}
      </div>

      {/* ─── Content ────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p
            className={cn(
              "text-[hsl(var(--fg-primary))] group-hover:text-[hsl(var(--color-primary))] transition-colors",
              isSm ? "text-xs" : "text-sm"
            )}
          >
            {activity.title}
          </p>
          {!activity.isRead && (
            <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-[hsl(var(--color-destructive))]" />
          )}
        </div>

        {activity.description && (
          <p
            className={cn(
              "text-[hsl(var(--fg-secondary))] line-clamp-2",
              isSm ? "text-[10px] mt-0.5" : "text-xs mt-0.5"
            )}
          >
            {activity.description}
          </p>
        )}

        <div className="flex items-center gap-2 mt-0.5">
          {activity.actor && (
            <span className="text-[10px] text-[hsl(var(--fg-tertiary))] flex items-center gap-1">
              <User className="w-3 h-3" />
              {activity.actor}
            </span>
          )}
          <span className="text-[10px] text-[hsl(var(--fg-tertiary))]">
            {formatTime(activity.timestamp)}
          </span>
        </div>
      </div>
    </button>
  );
});

ActivityItem.displayName = "ActivityItem";