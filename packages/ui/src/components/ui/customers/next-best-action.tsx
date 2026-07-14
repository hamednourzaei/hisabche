// packages/ui/src/components/ui/customers/next-best-action.tsx
"use client"

import { ChevronLeft } from "lucide-react"
import { cn } from "@/lib/utils"

interface NextBestActionProps {
  t: (key: string, fallback?: string) => string
  hasOverdueInvoices: boolean
  daysSinceLastPurchase: number
  lifetimeValue: number
  isVip: boolean
  onAction: (action: any) => void
}

export function NextBestAction({ t, hasOverdueInvoices, onAction }: NextBestActionProps) {
  if (!hasOverdueInvoices) return null

  return (
    <div className="glass-card animate-fade-in-up">
      <div className="p-4">
        <p className="text-xs font-medium text-[hsl(var(--fg-tertiary))] mb-3">
          🎯 {t("customers.nextBestAction", "اقدام پیشنهادی")}
        </p>
        <button
          type="button"
          onClick={() => onAction({ type: 'payment' })}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl p-3 text-start",
            "border border-[hsl(var(--border-default))]",
            "hover:bg-[hsl(var(--surface-muted))] hover:border-[hsl(var(--color-primary)/0.3)]",
            "transition-all duration-200 group",
          )}
        >
          <span className="flex-1 text-sm text-[hsl(var(--fg-secondary))] group-hover:text-[hsl(var(--fg-primary))]">
            {t("customers.actionPayment", "ثبت پرداخت برای فاکتورهای باز")}
          </span>
          <ChevronLeft className="size-4 text-[hsl(var(--fg-tertiary))]" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}