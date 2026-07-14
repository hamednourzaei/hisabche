// packages/ui/src/components/ui/customers/customer-opportunities-tab.tsx
"use client"

import { Target, TrendingUp, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

interface CustomerOpportunitiesTabProps {
  t: (key: string, fallback?: string) => string
  fmt: (v: number) => string
  opportunities: any[]
}

const cardBase = "rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] shadow-sm"
const outlineBtn = "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))] transition-colors duration-150 motion-reduce:transition-none"

const stageColors: Record<string, string> = {
  lead: "bg-[hsl(var(--fg-tertiary)/0.1)] text-[hsl(var(--fg-secondary))]",
  qualified: "bg-[hsl(var(--color-info)/0.1)] text-[hsl(var(--color-info))]",
  proposal: "bg-[hsl(var(--color-warning)/0.1)] text-[hsl(var(--color-warning))]",
  negotiation: "bg-[hsl(var(--color-primary)/0.1)] text-[hsl(var(--color-primary))]",
  won: "bg-[hsl(var(--color-success)/0.1)] text-[hsl(var(--color-success))]",
  lost: "bg-[hsl(var(--color-destructive)/0.1)] text-[hsl(var(--color-destructive))]",
}

const stageLabels: Record<string, string> = {
  lead: "سرنخ",
  qualified: "واجد شرایط",
  proposal: "پیشنهاد",
  negotiation: "مذاکره",
  won: "برنده",
  lost: "از دست رفته",
}

export function CustomerOpportunitiesTab({ t, fmt, opportunities }: CustomerOpportunitiesTabProps) {
  return (
    <div className={cn(cardBase, "animate-fade-in-up")}>
      
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-[hsl(var(--border-default))]">
        <h3 className="text-lg font-semibold text-[hsl(var(--fg-primary))]">
          {t("customers.opportunities", "فرصت‌های فروش")}
        </h3>
        <button type="button" className={outlineBtn}>
          <Plus className="size-4" aria-hidden="true" />
          {t("customers.addOpportunity", "افزودن")}
        </button>
      </div>

      {/* Content */}
      <div className="p-5">
        {opportunities.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))]">
              <Target className="size-6 text-[hsl(var(--fg-tertiary))]" aria-hidden="true" />
            </div>
            <p className="text-sm text-[hsl(var(--fg-secondary))]">
              {t("customers.noOpportunities", "هنوز فرصت فروشی ثبت نشده")}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {opportunities.map((opp: any) => (
              <div
                key={opp.id}
                className="flex gap-3 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] p-4"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--color-primary)/0.1)]">
                  <TrendingUp className="size-4 text-[hsl(var(--color-primary))]" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-[hsl(var(--fg-primary))] truncate">
                      {opp.title}
                    </p>
                    <span className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0",
                      stageColors[opp.stage] || stageColors.lead,
                    )}>
                      {stageLabels[opp.stage] || opp.stage}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-xs text-[hsl(var(--fg-secondary))]">
                    <span className="font-bold tabular-nums text-[hsl(var(--fg-primary))]">
                      {fmt(opp.value || 0)} AFN
                    </span>
                    <span>{opp.probability || 0}%</span>
                    {opp.expectedCloseDate && (
                      <span>
                        {new Date(opp.expectedCloseDate || opp.expected_close_date).toLocaleDateString('fa-IR')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}