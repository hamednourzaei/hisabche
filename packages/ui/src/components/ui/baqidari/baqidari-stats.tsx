// packages/ui/src/components/ui/baqidari/baqidari-stats.tsx
"use client";

import { cn } from "@/lib/utils";
import { TrendingUp, DollarSign, TrendingDown } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   BaqidariStats v2 — Hisabche Design Language
   Zero hardcoded colors — all tokens from design system
   No external component dependencies (Card, CardContent removed)
   ═══════════════════════════════════════════════════════════════════════════ */

interface BaqidariStatsProps {
  t: (key: string, fallback?: string) => string;
  debtorCount: number;
  totalDebt: number;
  openDealsCount: number;
  fmt: (v: number) => string;
}

const statCardBase =
  "flex items-center gap-3 p-4 rounded-2xl border border-[hsl(var(--border-default))] bg-gradient-to-br";

export function BaqidariStats({
  t,
  debtorCount,
  totalDebt,
  openDealsCount,
  fmt,
}: BaqidariStatsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {/* Debtor Count */}
      <div
        className={cn(
          statCardBase,
          "from-[hsl(var(--color-destructive)/0.1)] to-[hsl(var(--color-destructive)/0.02)]",
        )}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--color-destructive)/0.1)] shrink-0">
          <TrendingUp
            className="size-5 text-[hsl(var(--color-destructive))]"
            aria-hidden="true"
          />
        </div>
        <div>
          <p className="text-xl font-bold tabular-nums text-[hsl(var(--fg-primary))]">
            {debtorCount}
          </p>
          <p className="text-xs text-[hsl(var(--fg-secondary))]">
            {t("baqidari.debtorCount", "تعداد بدهکاران")}
          </p>
        </div>
      </div>

      {/* Total Debt */}
      <div
        className={cn(
          statCardBase,
          "from-[hsl(var(--color-destructive)/0.1)] to-[hsl(var(--color-destructive)/0.02)]",
        )}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--color-destructive)/0.1)] shrink-0">
          <DollarSign
            className="size-5 text-[hsl(var(--color-destructive))]"
            aria-hidden="true"
          />
        </div>
        <div>
          <p className="text-xl font-bold tabular-nums text-[hsl(var(--fg-primary))]">
            {fmt(totalDebt)}
          </p>
          <p className="text-xs text-[hsl(var(--fg-secondary))]">
            {t("baqidari.totalDebt", "مجموع بدهی")} (AFN)
          </p>
        </div>
      </div>

      {/* Open Deals */}
      <div
        className={cn(
          statCardBase,
          "from-[hsl(var(--color-warning)/0.1)] to-[hsl(var(--color-warning)/0.02)]",
        )}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--color-warning)/0.1)] shrink-0">
          <TrendingDown
            className="size-5 text-[hsl(var(--color-warning))]"
            aria-hidden="true"
          />
        </div>
        <div>
          <p className="text-xl font-bold tabular-nums text-[hsl(var(--fg-primary))]">
            {openDealsCount}
          </p>
          <p className="text-xs text-[hsl(var(--fg-secondary))]">
            {t("baqidari.openDeals", "معاملات باز")}
          </p>
        </div>
      </div>
    </div>
  );
}