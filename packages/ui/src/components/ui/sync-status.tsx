"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import { Clock, Cloud } from "lucide-react";
import { Badge } from "./badge";

export interface SyncStatusProps {
  lastSyncedAt: number | null;
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  className?: string;
}

function timeAgo(timestamp: number, t: (key: string, fallback: string) => string): string {
  const s = Math.floor((Date.now() - timestamp) / 1000);
  if (s < 10) return t("sync.justNow", "لحظاتی پیش");
  if (s < 60) return t("sync.secondsAgo", `${s} ثانیه پیش`).replace("{s}", String(s));
  const m = Math.floor(s / 60);
  if (m < 60) return t("sync.minutesAgo", `${m} دقیقه پیش`).replace("{m}", String(m));
  return t("sync.hoursAgo", `${Math.floor(m / 60)} ساعت پیش`).replace("{h}", String(Math.floor(m / 60)));
}

const SyncStatus: React.FC<SyncStatusProps> = ({
  lastSyncedAt,
  isOnline,
  isSyncing,
  pendingCount,
  className,
}) => {
  const { t } = useTranslation();

  return (
    <div className={cn("flex items-center gap-3 text-xs", className)} role="status" aria-live="polite">
      {isOnline ? (
        <Badge variant="success" className="gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {t("sync.online", "آنلاین")}
        </Badge>
      ) : (
        <Badge variant="warning" className="gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {t("sync.offline", "آفلاین")}
        </Badge>
      )}

      <div className="h-3 w-px bg-border" />

      {isSyncing ? (
        <Badge variant="secondary" className="gap-1 animate-pulse">
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {t("sync.syncing", "همگام‌سازی...")}
        </Badge>
      ) : lastSyncedAt ? (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="size-3.5" aria-hidden />
          <span>{timeAgo(lastSyncedAt, t)}</span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Cloud className="size-3.5" aria-hidden />
          <span>{t("sync.notSynced", "همگام‌سازی نشده")}</span>
        </div>
      )}

      {pendingCount > 0 && (
        <>
          <div className="h-3 w-px bg-border" />
          <Badge variant="warning" className="gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {t("sync.pending", `${pendingCount} در انتظار`).replace("{count}", String(pendingCount))}
          </Badge>
        </>
      )}
    </div>
  );
};

export { SyncStatus };