// packages/ui/src/components/ui/warehouse/warehouse-stats.tsx
"use client";

import { memo, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Package, AlertTriangle, DollarSign } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   WarehouseStats v5 — Memoized · Performance Optimized · PascalCase
   ✅ memo · useMemo · PascalCase
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
  icon: React.ElementType;
  tone: Tone;
  isLoading?: boolean;
}

const StatCard = memo(function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  isLoading = false,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-4 rounded-2xl",
        "border border-[hsl(var(--border-default))]",
        "bg-gradient-to-br",
        TONE_BG[tone],
      )}
    >
      <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl shrink-0", TONE_ICON[tone])}>
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <div>
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
    </div>
  );
});
StatCard.displayName = "StatCard";

interface WarehouseStatsProps {
  t: (key: string, fallback?: string) => string;
  fmt: (v: number) => string;
  total: number;
  lowStock: number;
  outOfStock: number;
  totalValue: number;
  isLoading?: boolean;
}

function getLowStockTone(value: number): Tone {
  if (value === 0) return "emerald";
  if (value < 5) return "rose";
  if (value < 15) return "amber";
  return "purple";
}

function getOutOfStockTone(value: number): Tone {
  if (value === 0) return "emerald";
  if (value > 20) return "rose";
  if (value > 10) return "amber";
  return "purple";
}

function getTotalValueTone(value: number): Tone {
  if (value > 1_000_000) return "emerald";
  if (value > 500_000) return "purple";
  if (value > 100_000) return "amber";
  return "rose";
}

export const WarehouseStats = memo(function WarehouseStats({
  t,
  fmt,
  total,
  lowStock,
  outOfStock,
  totalValue,
  isLoading = false,
}: WarehouseStatsProps) {
  const tones = useMemo(
    () => ({
      lowStock: getLowStockTone(lowStock),
      outOfStock: getOutOfStockTone(outOfStock),
      totalValue: getTotalValueTone(totalValue),
    }),
    [lowStock, outOfStock, totalValue]
  );

  const hints = useMemo(
    () => ({
      lowStock: lowStock === 0 ? t("warehouse.noLowStock", "هیچ محصولی با موجودی کم نیست") : undefined,
      outOfStock: outOfStock === 0 ? t("warehouse.noOutOfStock", "هیچ محصول ناموجودی نیست") : undefined,
    }),
    [lowStock, outOfStock, t]
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label={t("warehouse.totalProducts", "کل محصولات")}
        value={total}
        icon={Package}
        tone="purple"
        isLoading={isLoading}
      />

      <StatCard
        label={t("warehouse.lowStock", "موجودی کم")}
        value={lowStock}
        icon={AlertTriangle}
        tone={tones.lowStock}
        hint={hints.lowStock}
        isLoading={isLoading}
      />

      <StatCard
        label={t("warehouse.outOfStock", "ناموجود")}
        value={outOfStock}
        icon={AlertTriangle}
        tone={tones.outOfStock}
        hint={hints.outOfStock}
        isLoading={isLoading}
      />

      <StatCard
        label={t("warehouse.totalValue", "ارزش کل (AFN)")}
        value={fmt(totalValue)}
        icon={DollarSign}
        tone={tones.totalValue}
        isLoading={isLoading}
      />
    </div>
  );
});

WarehouseStats.displayName = "WarehouseStats";