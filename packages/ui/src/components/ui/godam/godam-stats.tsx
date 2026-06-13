"use client";

import { cn } from "@/lib/utils";
import { Package, AlertTriangle, DollarSign, type LucideIcon } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   GodamStats v2 — Hisabche Design Language
   Zero hardcoded colors — all tokens from design system
   No external component dependencies (Skeleton removed)
   ═══════════════════════════════════════════════════════════════════════════ */

type Tone = "emerald" | "amber" | "rose" | "purple" | "blue" | "teal";

const TONE_BG: Record<Tone, string> = {
  emerald: "from-[hsl(var(--color-success)/0.1)] to-[hsl(var(--color-success)/0.02)]",
  amber: "from-[hsl(var(--color-warning)/0.1)] to-[hsl(var(--color-warning)/0.02)]",
  rose: "from-[hsl(var(--color-destructive)/0.1)] to-[hsl(var(--color-destructive)/0.02)]",
  purple: "from-[hsl(var(--color-primary)/0.1)] to-[hsl(var(--color-primary)/0.02)]",
  blue: "from-[hsl(210_100%_50%/0.1)] to-[hsl(210_100%_50%/0.02)]",
  teal: "from-[hsl(170_70%_45%/0.1)] to-[hsl(170_70%_45%/0.02)]",
};

const TONE_ICON: Record<Tone, string> = {
  emerald: "bg-[hsl(var(--color-success)/0.15)] text-[hsl(var(--color-success))]",
  amber: "bg-[hsl(var(--color-warning)/0.15)] text-[hsl(var(--color-warning))]",
  rose: "bg-[hsl(var(--color-destructive)/0.15)] text-[hsl(var(--color-destructive))]",
  purple: "bg-[hsl(var(--color-primary)/0.15)] text-[hsl(var(--color-primary))]",
  blue: "bg-[hsl(210_100%_50%/0.15)] text-[hsl(210_100%_50%)]",
  teal: "bg-[hsl(170_70%_45%/0.15)] text-[hsl(170_70%_45%)]",
};

interface GodamStatCardProps {
  label: string;
  value: string | number;
  hint?: string | undefined;
  Icon: LucideIcon;
  tone: Tone;
  onClick?: () => void;
  isLoading?: boolean;
}

function GodamStatCard({
  label,
  value,
  hint,
  Icon,
  tone,
  onClick,
  isLoading = false,
}: GodamStatCardProps) {
  const Wrap = onClick ? "button" : "div";

  return (
    <Wrap
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className={cn(
        "group relative overflow-hidden rounded-xl p-5 text-start",
        "bg-gradient-to-br",
        TONE_BG[tone],
        "border border-[hsl(var(--border-default))]",
        "motion-safe:transition-all motion-safe:hover:-translate-y-0.5",
        onClick ? "cursor-pointer" : "cursor-default",
      )}
    >
      <div className="mb-4 flex items-center justify-between">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl",
            TONE_ICON[tone],
          )}
        >
          <Icon className="size-5" aria-hidden="true" />
        </div>
      </div>

      <p className="mb-1 text-xs font-medium text-[hsl(var(--fg-secondary))]">
        {label}
      </p>

      {isLoading ? (
        <div className="h-8 w-32 rounded-lg bg-[hsl(var(--surface-muted))] animate-pulse" />
      ) : (
        <p className="text-2xl font-bold tabular-nums sm:text-3xl text-[hsl(var(--fg-primary))]">
          {value}
        </p>
      )}

      {hint && (
        <p className="mt-1.5 text-[10px] text-[hsl(var(--fg-tertiary))]">
          {hint}
        </p>
      )}
    </Wrap>
  );
}

interface GodamStatsProps {
  t: (key: string, fallback?: string) => string;
  fmt: (v: number) => string;
  total: number;
  lowStock: number;
  outOfStock: number;
  totalValue: number;
  isLoading?: boolean;
}

export function GodamStats({
  t,
  fmt,
  total,
  lowStock,
  outOfStock,
  totalValue,
  isLoading = false,
}: GodamStatsProps) {
  const getLowStockTone = (value: number): Tone => {
    if (value === 0) return "emerald";
    if (value < 5) return "rose";
    if (value < 15) return "amber";
    return "blue";
  };

  const getOutOfStockTone = (value: number): Tone => {
    if (value === 0) return "emerald";
    if (value > 20) return "rose";
    if (value > 10) return "amber";
    return "teal";
  };

  const getTotalValueTone = (value: number): Tone => {
    if (value > 1_000_000) return "emerald";
    if (value > 500_000) return "blue";
    if (value > 100_000) return "teal";
    return "purple";
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <GodamStatCard
        label={t("godam.totalProducts", "کل محصولات")}
        value={total}
        Icon={Package}
        tone="purple"
        isLoading={isLoading}
      />

      <GodamStatCard
        label={t("godam.lowStock", "موجودی کم")}
        value={lowStock}
        Icon={AlertTriangle}
        tone={getLowStockTone(lowStock)}
        hint={
          lowStock === 0
            ? t("godam.noLowStock", "هیچ محصولی با موجودی کم نیست")
            : undefined
        }
        isLoading={isLoading}
      />

      <GodamStatCard
        label={t("godam.outOfStock", "ناموجود")}
        value={outOfStock}
        Icon={AlertTriangle}
        tone={getOutOfStockTone(outOfStock)}
        hint={
          outOfStock === 0
            ? t("godam.noOutOfStock", "هیچ محصول ناموجودی نیست")
            : undefined
        }
        isLoading={isLoading}
      />

      <GodamStatCard
        label={t("godam.totalValue", "ارزش کل (AFN)")}
        value={fmt(totalValue)}
        Icon={DollarSign}
        tone={getTotalValueTone(totalValue)}
        isLoading={isLoading}
      />
    </div>
  );
}