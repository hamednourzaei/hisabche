// packages/ui/src/components/ui/activity/RealtimeStatus.tsx
"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";

interface RealtimeStatusProps {
  isConnected: boolean;
  onReconnect: () => void;
  className?: string;
}

export const RealtimeStatus = memo(function RealtimeStatus({
  isConnected,
  onReconnect,
  className,
}: RealtimeStatusProps) {
  return (
    <button
      type="button"
      onClick={onReconnect}
      className={cn(
        "flex items-center gap-1.5 text-[10px] transition-colors",
        isConnected
          ? "text-[hsl(var(--color-success))]"
          : "text-[hsl(var(--color-warning))]",
        className
      )}
    >
      {isConnected ? (
        <>
          <Wifi className="size-3" />
          <span className="hidden sm:inline">زنده</span>
        </>
      ) : (
        <>
          <WifiOff className="size-3" />
          <span className="hidden sm:inline">اتصال مجدد</span>
          <RefreshCw className="size-3 animate-spin" />
        </>
      )}
    </button>
  );
});

RealtimeStatus.displayName = "RealtimeStatus";