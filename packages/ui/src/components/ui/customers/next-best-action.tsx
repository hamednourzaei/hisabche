// packages/ui/src/components/ui/customers/next-best-action.tsx
"use client"

import { Phone, MessageSquare, Gift, Tag, AlertTriangle, ChevronLeft } from "lucide-react"
import { cn } from "@/lib/utils"

interface Action {
  id: string
  type: 'call' | 'sms' | 'offer' | 'tag' | 'reminder'
  labelKey: string
  fallback: string
  priority: number
  icon: any
}

interface NextBestActionProps {
  t: (key: string, fallback?: string) => string
  hasOverdueInvoices: boolean
  daysSinceLastPurchase: number
  lifetimeValue: number
  isVip: boolean
  onAction: (action: Action) => void
}

function getActions(t: (key: string, fallback?: string) => string, props: Omit<NextBestActionProps, 't' | 'onAction'>): Action[] {
  const actions: Action[] = []

  if (props.hasOverdueInvoices) {
    actions.push({
      id: 'call', type: 'call',
      labelKey: 'customers.actionCall',
      fallback: 'تماس برای پیگیری پرداخت',
      priority: 1, icon: Phone,
    })
    actions.push({
      id: 'sms', type: 'sms',
      labelKey: 'customers.actionSms',
      fallback: 'ارسال پیامک یادآوری',
      priority: 2, icon: MessageSquare,
    })
  }

  if (props.daysSinceLastPurchase > 30) {
    actions.push({
      id: 'offer', type: 'offer',
      labelKey: 'customers.actionOffer',
      fallback: 'ارسال پیشنهاد ویژه',
      priority: 3, icon: Gift,
    })
  }

  if (props.lifetimeValue > 100000 && !props.isVip) {
    actions.push({
      id: 'tag-vip', type: 'tag',
      labelKey: 'customers.actionVip',
      fallback: 'ارتقا به VIP',
      priority: 4, icon: Tag,
    })
  }

  if (props.hasOverdueInvoices) {
    actions.push({
      id: 'reminder', type: 'reminder',
      labelKey: 'customers.actionReminder',
      fallback: 'تنظیم یادآوری پیگیری',
      priority: 5, icon: AlertTriangle,
    })
  }

  return actions.sort((a, b) => a.priority - b.priority).slice(0, 3)
}

export function NextBestAction(props: NextBestActionProps) {
  const { t } = props
  const actions = getActions(t, props)

  if (actions.length === 0) return null

  return (
    <div className="glass-card animate-fade-in-up stagger-up">
      <div className="p-4">
        <p className="text-xs font-medium text-[hsl(var(--fg-tertiary))] mb-3">
          🎯 {t("customers.nextBestAction", "اقدام پیشنهادی")}
        </p>
        <div className="space-y-2">
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={() => props.onAction(action)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl p-3 text-start",
                "border border-[hsl(var(--border-default))]",
                "hover:bg-[hsl(var(--surface-muted))] hover:border-[hsl(var(--color-primary)/0.3)]",
                "transition-all duration-200 motion-reduce:transition-none",
                "group",
              )}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--color-primary)/0.1)]">
                <action.icon className="size-4 text-[hsl(var(--color-primary))]" aria-hidden="true" />
              </div>
              <span className="flex-1 text-sm text-[hsl(var(--fg-secondary))] group-hover:text-[hsl(var(--fg-primary))]">
                {t(action.labelKey, action.fallback)}
              </span>
              <ChevronLeft className="size-4 text-[hsl(var(--fg-tertiary))] group-hover:text-[hsl(var(--color-primary))]" aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}