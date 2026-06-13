"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   RealtimeIndicator v2 — Hisabche Design Language
   Zero hardcoded colors — all tokens from design system
   ═══════════════════════════════════════════════════════════════════════════ */

export function RealtimeIndicator() {
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    const checkConnection = () => setConnected(navigator.onLine);

    checkConnection();
    window.addEventListener("online", checkConnection);
    window.addEventListener("offline", checkConnection);

    return () => {
      window.removeEventListener("online", checkConnection);
      window.removeEventListener("offline", checkConnection);
    };
  }, []);

  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={connected ? "آنلاین" : "آفلاین"}
      className={cn(
        "inline-flex items-center gap-1.5",
        "px-2.5 py-1",
        "rounded-full",
        "text-xs font-medium",
        "transition-colors duration-300",
        "motion-reduce:transition-none",
        connected
          ? "bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))] border border-[hsl(var(--color-success)/0.2)]"
          : "bg-[hsl(var(--color-warning)/0.12)] text-[hsl(var(--color-warning))] border border-[hsl(var(--color-warning)/0.2)]",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          connected
            ? "bg-[hsl(var(--color-success))]"
            : "bg-[hsl(var(--color-warning))]",
        )}
        aria-hidden="true"
      />
      {connected ? "زنده" : "قطع"}
    </span>
  );
}