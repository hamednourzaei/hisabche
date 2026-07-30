// packages/ui/src/components/ui/warehouse/warehouse-stats.tsx
"use client";

import { memo, useMemo, useRef, useState, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { Package, AlertTriangle, DollarSign, ChevronDown } from "lucide-react";
import type { Product } from "../../../lib/warehouse/warehouse-types";

/* ═══════════════════════════════════════════════════════════════════════════
   WarehouseStats v6 — یک ردیف افقی در همه‌ی ابعاد (بدون stack شدن در موبایل)
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
  action?: React.ReactNode;
}

const StatCard = memo(function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  isLoading = false,
  action,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "flex min-w-[220px] shrink-0 items-start justify-between gap-3 p-4 rounded-2xl",
        "border border-[hsl(var(--border-default))]",
        "bg-gradient-to-br",
        TONE_BG[tone],
      )}
    >
      <div className="flex items-start gap-3">
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
      {action}
    </div>
  );
});
StatCard.displayName = "StatCard";

// ─── دراپ‌داون آستانه‌ی «موجودی کم» — کاربر خودش تعیین می‌کند زیر چه عددی کم حساب شود ───

const THRESHOLD_PRESETS = [5, 10] as const;

const LowStockThresholdPicker = memo(function LowStockThresholdPicker({
  threshold,
  onChange,
  t,
}: {
  threshold: number;
  onChange: (v: number) => void;
  t: (key: string, fallback?: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(String(threshold));
  const btnRef = useRef<HTMLButtonElement>(null);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null);

  // ✅ FIX: قبلاً پنل با position:absolute داخل ردیف کارت‌ها (که خودش
  // overflow-x-auto دارد) رندر می‌شد — چون یک المان absolute می‌تواند
  // scrollWidth والد اسکرول‌شونده را عوض کند، مرورگر کل ردیف ۴ کارت را
  // برای نمایش پنل اسکرول افقی می‌کرد، به‌جای اینکه فقط خود پنل باز شود.
  // با رندر از طریق portal با position:fixed (خارج از هر والد اسکرول‌دار)
  // این مشکل کاملاً حل می‌شود.
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const update = () => {
      const rect = btnRef.current!.getBoundingClientRect();
      setPanelPos({ top: rect.bottom + 4, left: rect.right - 144 });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  return (
    <div className="shrink-0">
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex items-center gap-1 rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-2 py-1 text-[11px] text-[hsl(var(--fg-secondary))]"
      >
        {t("warehouse.lowStockThreshold", "زیر")} {threshold}
        <ChevronDown className="size-3" aria-hidden="true" />
      </button>
      {open && panelPos && typeof document !== "undefined" &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div
              className="fixed z-50 w-36 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-2 shadow-lg"
              style={{ top: panelPos.top, left: Math.max(8, panelPos.left) }}
            >
              {THRESHOLD_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    onChange(p);
                    setOpen(false);
                  }}
                  className="block w-full rounded-lg px-2 py-1.5 text-start text-xs text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))]"
                >
                  {t("warehouse.lowStockThreshold", "زیر")} {p}
                </button>
              ))}
              <div className="mt-1 flex gap-1 border-t border-[hsl(var(--border-default))] pt-1.5">
                <input
                  type="number"
                  min={1}
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  className="w-full rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-2 py-1 text-xs text-[hsl(var(--fg-primary))]"
                />
                <button
                  type="button"
                  onClick={() => {
                    const n = parseInt(custom);
                    if (n > 0) {
                      onChange(n);
                      setOpen(false);
                    }
                  }}
                  className="shrink-0 rounded-lg bg-[hsl(var(--color-primary))] px-2 py-1 text-xs font-medium text-white"
                >
                  {t("action.apply", "اعمال")}
                </button>
              </div>
            </div>
          </>,
          document.body
        )}
    </div>
  );
});
LowStockThresholdPicker.displayName = "LowStockThresholdPicker";

interface WarehouseStatsProps {
  t: (key: string, fallback?: string) => string;
  fmt: (v: number) => string;
  total: number;
  outOfStock: number;
  totalValue: number;
  products: Product[];
  isLoading?: boolean;
}

export const WarehouseStats = memo(function WarehouseStats({
  t,
  fmt,
  total,
  outOfStock,
  totalValue,
  products,
  isLoading = false,
}: WarehouseStatsProps) {
  const [lowStockThreshold, setLowStockThreshold] = useState(5);

  const lowStockCount = useMemo(
    () => products.filter((p) => p.quantity > 0 && p.quantity < lowStockThreshold).length,
    [products, lowStockThreshold]
  );

  const lowStockTone: Tone = lowStockCount === 0 ? "emerald" : lowStockCount < 5 ? "amber" : "rose";
  const outOfStockTone: Tone = outOfStock === 0 ? "emerald" : outOfStock > 10 ? "rose" : "amber";

  return (
    <div className="flex gap-4 overflow-x-auto pb-1 snap-x">
      <div className="snap-start">
        <StatCard
          label={t("warehouse.totalValue", "ارزش کل (AFN)")}
          value={fmt(totalValue)}
          icon={DollarSign}
          tone="purple"
          isLoading={isLoading}
        />
      </div>

      <div className="snap-start">
        <StatCard
          label={t("warehouse.totalProducts", "تعداد محصولات")}
          value={total}
          icon={Package}
          tone="purple"
          isLoading={isLoading}
        />
      </div>

      <div className="snap-start">
        <StatCard
          label={t("warehouse.lowStock", "موجودی کم")}
          value={lowStockCount}
          icon={AlertTriangle}
          tone={lowStockTone}
          isLoading={isLoading}
          action={<LowStockThresholdPicker threshold={lowStockThreshold} onChange={setLowStockThreshold} t={t} />}
        />
      </div>

      <div className="snap-start">
        <StatCard
          label={t("warehouse.outOfStock", "ناموجود")}
          value={outOfStock}
          icon={AlertTriangle}
          tone={outOfStockTone}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
});

WarehouseStats.displayName = "WarehouseStats";
