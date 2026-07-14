// packages/ui/src/components/ui/customers/customer-ai-summary.tsx
"use client"

import { Sparkles } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@hisabche/api"

interface CustomerAISummaryProps {
  t: (key: string, fallback?: string) => string
  customerId: string
  customerName: string
}

export function CustomerAISummary({ t, customerId, customerName }: CustomerAISummaryProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['ai', 'customer-summary', customerId],
    queryFn: async () => {
      const { data } = await apiClient.post('/ai/query', {
        question: `${t("customers.aiSummaryQuestion", "خلاصه وضعیت مشتری")} ${customerName} ${t("customers.aiSummaryDetail", "را بگو. میزان بدهی، تعداد خرید، میانگین تأخیر پرداخت و پیشنهاد برای اقدام بعدی.")}`,
      })
      return data?.answer || ''
    },
    staleTime: 5 * 60_000,
    enabled: !!customerId,
  })

  return (
    <div className="glass-card animate-fade-in-up">
      <div className="p-4">
        
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[hsl(var(--color-primary)/0.12)]">
            <Sparkles className="size-3.5 text-[hsl(var(--color-primary))]" aria-hidden="true" />
          </div>
          <p className="text-xs font-medium text-[hsl(var(--fg-tertiary))]">
            🤖 {t("customers.aiSummary", "خلاصه هوش مصنوعی")}
          </p>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="space-y-2">
            <div className="h-3 w-full rounded bg-[hsl(var(--surface-muted))] skeleton-shimmer" />
            <div className="h-3 w-3/4 rounded bg-[hsl(var(--surface-muted))] skeleton-shimmer" />
            <div className="h-3 w-1/2 rounded bg-[hsl(var(--surface-muted))] skeleton-shimmer" />
          </div>
        )}

        {/* Content */}
        {!isLoading && data && (
          <p className="text-sm text-[hsl(var(--fg-secondary))] leading-relaxed">
            {data}
          </p>
        )}

        {/* Empty */}
        {!isLoading && !data && (
          <p className="text-sm text-[hsl(var(--fg-tertiary))]">
            {t("customers.noAiData", "اطلاعات کافی برای تحلیل وجود ندارد.")}
          </p>
        )}

      </div>
    </div>
  )
}