// packages/ui/src/components/ui/activity/RealtimeStatus.tsx
"use client";

import { memo, useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Wifi, WifiOff, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";

interface RealtimeStatusProps {
  isConnected: boolean;
  onReconnect: () => void;
  className?: string;
  showLabel?: boolean;
  autoReconnect?: boolean;
  reconnectDelay?: number;
  lastUpdated?: Date | null;
}

export const RealtimeStatus = memo(function RealtimeStatus({
  isConnected,
  onReconnect,
  className,
  showLabel = true,
  autoReconnect = true,
  reconnectDelay = 5000,
  lastUpdated,
}: RealtimeStatusProps) {
  const { t } = useTranslation();
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  // ─── Auto reconnect ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isConnected && autoReconnect && !isReconnecting) {
      const timer = setTimeout(() => {
        setIsReconnecting(true);
        onReconnect();
        setReconnectAttempt((prev) => prev + 1);
      }, reconnectDelay);

      return () => clearTimeout(timer);
    }
    // ✅ FIX: return undefined when condition is false
    return undefined;
  }, [isConnected, autoReconnect, reconnectDelay, onReconnect, isReconnecting]);

  // ─── Reset reconnecting state ─────────────────────────────────────────────
  useEffect(() => {
    if (isConnected) {
      setIsReconnecting(false);
    }
  }, [isConnected]);

  // ─── Handle manual reconnect ──────────────────────────────────────────────
  const handleReconnect = useCallback(() => {
    if (!isReconnecting) {
      setIsReconnecting(true);
      onReconnect();
      setReconnectAttempt((prev) => prev + 1);
    }
  }, [onReconnect, isReconnecting]);

  // ─── Format last updated time ─────────────────────────────────────────────
  const formatLastUpdated = useCallback(() => {
    if (!lastUpdated) return null;
    return new Date(lastUpdated).toLocaleTimeString("fa-AF", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }, [lastUpdated]);

  const lastUpdatedStr = formatLastUpdated();

  // ─── Status variants ──────────────────────────────────────────────────────
  const variants = {
    connected: {
      icon: Wifi,
      color: "text-[hsl(var(--color-success))]",
      bg: "bg-[hsl(var(--color-success)/0.1)]",
      label: t("realtime.connected", "متصل"),
      description: t("realtime.live", "زنده"),
    },
    disconnected: {
      icon: WifiOff,
      color: "text-[hsl(var(--color-warning))]",
      bg: "bg-[hsl(var(--color-warning)/0.1)]",
      label: t("realtime.disconnected", "قطع"),
      description: t("realtime.offline", "آفلاین"),
    },
    reconnecting: {
      icon: RefreshCw,
      color: "text-[hsl(var(--color-info))]",
      bg: "bg-[hsl(var(--color-info)/0.1)]",
      label: t("realtime.reconnecting", "در حال اتصال مجدد"),
      description: t("realtime.attempt", "تلاش {{count}}", {
        count: reconnectAttempt,
      }),
    },
  };

  const status = isReconnecting
    ? variants.reconnecting
    : isConnected
    ? variants.connected
    : variants.disconnected;

  const StatusIcon = status.icon;

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-2.5 py-1.5 rounded-full text-[10px] font-medium transition-all duration-300",
        status.bg,
        status.color,
        className
      )}
      role="status"
      aria-live="polite"
    >
      <StatusIcon
        className={cn(
          "size-3.5 shrink-0",
          isReconnecting && "animate-spin"
        )}
        aria-hidden="true"
      />

      {showLabel && (
        <span className="hidden sm:inline">
          {status.label}
        </span>
      )}

      {!isConnected && reconnectAttempt > 0 && (
        <span className="hidden sm:inline text-[9px] opacity-70">
          ({t("realtime.attempt", "تلاش {{count}}", { count: reconnectAttempt })})
        </span>
      )}

      {isConnected && lastUpdatedStr && (
        <span className="hidden sm:inline text-[9px] opacity-70">
          • {lastUpdatedStr}
        </span>
      )}

      {!isConnected && (
        <button
          type="button"
          onClick={handleReconnect}
          disabled={isReconnecting}
          className={cn(
            "flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium",
            "hover:bg-[hsl(var(--surface-muted)/0.5)] transition-colors",
            "focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))]",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "min-h-[24px]"
          )}
          aria-label={t("realtime.reconnect", "اتصال مجدد")}
        >
          <RefreshCw
            className={cn(
              "size-3",
              isReconnecting && "animate-spin"
            )}
            aria-hidden="true"
          />
          <span className="hidden sm:inline">
            {isReconnecting
              ? t("realtime.connecting", "در حال اتصال...")
              : t("realtime.retry", "تلاش مجدد")}
          </span>
        </button>
      )}
    </div>
  );
});

RealtimeStatus.displayName = "RealtimeStatus";