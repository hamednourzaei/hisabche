// packages/ui/src/components/ui/customers/customer-360-header.tsx
'use client'

import { Phone, Star, TrendingUp, Wallet, Clock, MoreHorizontal } from 'lucide-react'
import { cn } from '../../../lib/utils'

interface Customer360HeaderProps {
  t: (key: string, fallback?: string) => string
  customer: {
    name: string
    phone?: string
    type: 'cash' | 'credit'
    tags: string[]
    healthScore: number
    totalDebt: number
    lifetimeValue: number
    lastActivity: string
  }
  fmt: (v: number) => string
  onQuickAction: (action: string) => void
}

const quickActions = [
  { id: 'invoice', labelKey: 'customers.quickInvoice', fallback: 'فاکتور', icon: Wallet },
  { id: 'payment', labelKey: 'customers.quickPayment', fallback: 'پرداخت', icon: TrendingUp },
  { id: 'call', labelKey: 'customers.quickCall', fallback: 'تماس', icon: Phone },
  { id: 'note', labelKey: 'customers.quickNote', fallback: 'یادداشت', icon: Clock },
]

const healthColor = (score: number) => {
  if (score >= 80) return 'text-[hsl(var(--color-success))]'
  if (score >= 50) return 'text-[hsl(var(--color-warning))]'
  return 'text-[hsl(var(--color-destructive))]'
}

const actionBtn = cn(
  'inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium',
  'border border-[hsl(var(--border-default))]',
  'text-[hsl(var(--fg-secondary))]',
  'hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]',
  'hover:border-[hsl(var(--color-primary)/0.3)]',
  'transition-all duration-200 motion-reduce:transition-none',
)

export function Customer360Header({ t, customer, fmt, onQuickAction }: Customer360HeaderProps) {
  return (
    <div className="glass-card animate-fade-in-up">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        {/* Identity */}
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--color-primary)/0.15)]">
            <span className="text-lg font-bold text-[hsl(var(--color-primary))]">
              {customer.name.charAt(0)}
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-lg font-bold text-[hsl(var(--fg-primary))]">
                {customer.name}
              </h2>
              {customer.tags.includes('vip') && (
                <Star
                  className="size-4 shrink-0 text-yellow-500 fill-yellow-500"
                  aria-hidden="true"
                />
              )}
            </div>
            {customer.phone && (
              <p className="text-sm text-[hsl(var(--fg-secondary))]">{customer.phone}</p>
            )}
          </div>
        </div>

        {/* KPIs */}
        <div className="flex flex-wrap gap-4 sm:gap-6">
          <div className="text-center">
            <p className={cn('text-lg font-bold tabular-nums', healthColor(customer.healthScore))}>
              {customer.healthScore}%
            </p>
            <p className="text-xs text-[hsl(var(--fg-tertiary))]">
              {t('customers.health', 'سلامت')}
            </p>
          </div>
          {customer.type === 'credit' && (
            <div className="text-center">
              <p className="text-lg font-bold tabular-nums text-[hsl(var(--color-destructive))]">
                {fmt(customer.totalDebt)}
              </p>
              <p className="text-xs text-[hsl(var(--fg-tertiary))]">
                {t('customers.debt', 'بدهی')}
              </p>
            </div>
          )}
          <div className="text-center">
            <p className="text-lg font-bold tabular-nums text-[hsl(var(--fg-primary))]">
              {fmt(customer.lifetimeValue)}
            </p>
            <p className="text-xs text-[hsl(var(--fg-tertiary))]">
              {t('customers.lifetimeValue', 'ارزش کل')}
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-1.5 flex-wrap">
          {quickActions.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={() => onQuickAction(action.id)}
              className={actionBtn}
            >
              <action.icon className="size-3.5" aria-hidden="true" />
              {t(action.labelKey, action.fallback)}
            </button>
          ))}
          <button
            type="button"
            className={cn(actionBtn, 'px-2')}
            aria-label={t('common.more', 'بیشتر')}
          >
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}
