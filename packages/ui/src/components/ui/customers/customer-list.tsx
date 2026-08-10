'use client'

import { cn } from '../../../lib/utils'
import { User, DollarSign } from 'lucide-react'
import type { CustomerWithDebt } from '../../../lib/customers/customers-types'

interface customersCustomerListProps {
  t: (key: string, fallback?: string) => string
  fmt: (v: number) => string
  customers: CustomerWithDebt[]
  onSelectCustomer: (id: string) => void
  onPaymentClick: (customer: CustomerWithDebt, e: React.MouseEvent) => void
}

export function customersCustomerList({
  t,
  fmt,
  customers,
  onSelectCustomer,
  onPaymentClick,
}: customersCustomerListProps) {
  return (
    <div className="space-y-3">
      {customers.map((customer) => {
        const hasDebt = (customer.totalDebt ?? 0) > 0
        const customerName = customer.fullName || customer.name || ''

        return (
          <div
            key={customer.id}
            onClick={() => onSelectCustomer(customer.id)}
            className={cn(
              'cursor-pointer rounded-2xl border border-[hsl(var(--border-default))]',
              'bg-[hsl(var(--surface-elevated))]',
              'hover:border-[hsl(var(--color-primary)/0.3)] transition-all duration-200',
            )}
          >
            <div className="flex items-center justify-between p-5">
              <div className="flex min-w-0 flex-1 items-center gap-3 text-start">
                <div
                  className={cn(
                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
                    hasDebt
                      ? 'bg-[hsl(var(--color-destructive)/0.1)]'
                      : 'bg-[hsl(var(--color-success)/0.1)]',
                  )}
                >
                  <User
                    className={cn(
                      'size-5',
                      hasDebt
                        ? 'text-[hsl(var(--color-destructive))]'
                        : 'text-[hsl(var(--color-success))]',
                    )}
                    aria-hidden
                  />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[hsl(var(--fg-primary))]">
                    {customerName}
                  </p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border',
                        hasDebt
                          ? 'bg-[hsl(var(--color-destructive)/0.12)] text-[hsl(var(--color-destructive))] border-[hsl(var(--color-destructive)/0.2)]'
                          : 'bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))] border-[hsl(var(--color-success)/0.2)]',
                      )}
                    >
                      {hasDebt ? t('customers.debtor', 'بدهکار') : t('customers.settled', 'تسویه')}
                    </span>
                    {(customer.openCount ?? 0) > 0 && (
                      <span className="text-xs text-[hsl(var(--fg-tertiary))]">
                        {customer.openCount} {t('customers.openDeals', 'معامله باز')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="ms-3 flex shrink-0 items-center gap-3">
                {hasDebt && (
                  <div className="text-end">
                    <p className="font-bold tabular-nums text-[hsl(var(--color-destructive))]">
                      {fmt(customer.totalDebt ?? 0)} AFN
                    </p>
                  </div>
                )}
                <button
                  type="button"
                  onClick={(e) => onPaymentClick(customer, e)}
                  className="inline-flex items-center justify-center rounded-full p-2 text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--color-success))] transition-colors"
                  aria-label={`${t('customers.recordPaymentFor', 'ثبت پرداخت برای')} ${customerName}`}
                >
                  <DollarSign className="size-4 text-[hsl(var(--color-success))]" aria-hidden />
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
