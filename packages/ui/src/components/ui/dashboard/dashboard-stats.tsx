// packages/ui/src/components/ui/dashboard/dashboard-stats.tsx
"use client";

import { cn } from "@/lib/utils";
import { ArrowUpRight, type LucideIcon } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   DashboardStats v3 — GodamStats-style Compact Horizontal Design
   Zero hardcoded colors — all tokens from design system
   ═══════════════════════════════════════════════════════════════════════════ */

type Tone = "emerald" | "amber" | "rose" | "purple";

const TONE_BG: Record<Tone, string> = {
  emerald: "from-[hsl(var(--color-success)/0.1)] to-[hsl(var(--color-success)/0.02)]",
  amber: "from-[hsl(var(--color-warning)/0.1)] to-[hsl(var(--color-warning)/0.02)]",
  rose: "from-[hsl(var(--color-destructive)/0.1)] to-[hsl(var(--color-destructive)/0.02)]",
  purple: "from-[hsl(var(--color-primary)/0.1)] to-[hsl(var(--color-primary)/0.02)]",
};

const TONE_ICON: Record<Tone, string> = {
  emerald: "bg-[hsl(var(--color-success)/0.15)] text-[hsl(var(--color-success))]",
  amber: "bg-[hsl(var(--color-warning)/0.15)] text-[hsl(var(--color-warning))]",
  rose: "bg-[hsl(var(--color-destructive)/0.15)] text-[hsl(var(--color-destructive))]",
  purple: "bg-[hsl(var(--color-primary)/0.15)] text-[hsl(var(--color-primary))]",
};

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string | undefined;
  Icon: LucideIcon;
  tone: Tone;
  onClick?: () => void;
  isLoading?: boolean;
}

export function StatCard({
  label,
  value,
  hint,
  Icon,
  tone,
  onClick,
  isLoading = false,
}: StatCardProps) {
  const Wrap = onClick ? "button" : "div";

  return (
    <Wrap
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className={cn(
        "flex items-center gap-3 p-4 rounded-2xl text-start",
        "border border-[hsl(var(--border-default))]",
        "bg-gradient-to-br",
        TONE_BG[tone],
        onClick && "cursor-pointer motion-safe:hover:-translate-y-0.5 motion-safe:transition-all",
      )}
    >
      {/* Icon */}
      <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl shrink-0", TONE_ICON[tone])}>
        <Icon className="size-5" aria-hidden="true" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {isLoading ? (
          <>
            <div className="h-5 w-20 rounded bg-[hsl(var(--surface-muted))] animate-pulse mb-1" />
            <div className="h-3 w-16 rounded bg-[hsl(var(--surface-muted))] animate-pulse" />
          </>
        ) : (
          <>
            <p className="text-xl font-bold tabular-nums text-[hsl(var(--fg-primary))]">
              {value}
            </p>
            <p className="text-xs text-[hsl(var(--fg-secondary))]">{label}</p>
          </>
        )}
        {hint && !isLoading && (
          <p className="text-[10px] text-[hsl(var(--fg-tertiary))] mt-0.5">{hint}</p>
        )}
      </div>

      {/* Arrow indicator (clickable only) */}
      {onClick && (
        <ArrowUpRight
          className="size-4 shrink-0 text-[hsl(var(--fg-tertiary))] opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden="true"
        />
      )}
    </Wrap>
  );
}