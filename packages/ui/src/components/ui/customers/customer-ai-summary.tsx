// packages/ui/src/components/ui/customers/customer-ai-summary.tsx
"use client"

import { Sparkles } from "lucide-react"

interface CustomerAISummaryProps {
  t: (key: string, fallback?: string) => string
  customerId: string
  customerName: string
}

export function CustomerAISummary({ t, customerId, customerName }: CustomerAISummaryProps) {
  return (
    <div className="glass-card animate-fade-in-up">
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[hsl(var(--color-primary)/0.12)]">
            <Sparkles className="size-3.5 text-[hsl(var(--color-primary))]" aria-hidden="true" />
          </div>
          <p className="text-xs font-medium text-[hsl(var(--fg-tertiary))]">
            🤖 {t("customers.aiSummary", "خلاصه هوش مصنوعی")}
          </p>
        </div>
        <p className="text-sm text-[hsl(var(--fg-secondary))] leading-relaxed">
          {t("customers.aiComingSoon", "به زودی — تحلیل هوشمند وضعیت مشتری")}
        </p>
      </div>
    </div>
  )
}