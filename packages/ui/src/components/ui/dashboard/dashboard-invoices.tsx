// packages/ui/src/components/ui/dashboard/dashboard-invoices.tsx
'use client'

import { memo, useCallback } from 'react'
import { Button } from '../button'
import { Skeleton } from '../skeleton'
import { Receipt, PlusCircle, User } from 'lucide-react'
import { useCurrency } from '../../../hooks/dashboard/use-currency'

// ─── Types ────────────────────────────────────────────────────────────────

type Translate = (key: string, fallback?: string) => string

interface RecentInvoice {
  id: string
  customer: string
  total: number
  date: string
}

interface DashboardInvoicesProps {
  t: Translate
  invLoading: boolean
  recentInvoices: RecentInvoice[]
  onNavigateInvoice: (id: string) => void
  onNavigateQuickInvoice: () => void
  onViewAllInvoices: () => void
}

// ─── Skeleton ──────────────────────────────────────────────────────────────

const InvoiceRowSkeleton = memo(function InvoiceRowSkeleton() {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated)/0.5)] p-3 sm:p-4">
      <div className="space-y-1.5 sm:space-y-2">
        <Skeleton className="h-3 w-24 sm:w-32 rounded-md" />
        <Skeleton className="h-2.5 w-16 sm:w-20 rounded-md" />
      </div>
      <Skeleton className="h-3.5 w-16 sm:w-24 rounded-md" />
    </div>
  )
})
InvoiceRowSkeleton.displayName = 'InvoiceRowSkeleton'

// ─── Recent Invoice Row ───────────────────────────────────────────────────

const RecentInvoiceRow = memo(function RecentInvoiceRow({
  inv,
  onNavigateInvoice,
  t,
  format,
}: {
  inv: RecentInvoice
  onNavigateInvoice: (id: string) => void
  t: Translate
  format: (v: number) => string
}) {
  const displayName = inv.customer?.trim() || t('common.noCustomer')

  const handleClick = useCallback(() => {
    onNavigateInvoice(inv.id)
  }, [inv.id, onNavigateInvoice])

  return (
    <button
      type="button"
      onClick={handleClick}
      className="interactive-card group flex w-full items-center justify-between rounded-xl p-3 sm:p-4 text-start motion-safe:transition-all hover:bg-[hsl(var(--surface-muted)/0.5)] focus-visible:ring-4 focus-visible:ring-[hsl(var(--color-info)/0.3)] focus-visible:outline-none"
      aria-label={t('invoice.open') + ' ' + displayName}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
        <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[hsl(var(--color-primary)/0.15)] to-[hsl(var(--color-info)/0.15)] text-[hsl(var(--color-primary))]">
          <User className="size-3.5 sm:size-4" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs sm:text-sm font-semibold text-[hsl(var(--fg-primary))]">
            {displayName}
          </p>
          <p className="text-[9px] sm:text-xs text-[hsl(var(--fg-secondary))]">{inv.date}</p>
        </div>
      </div>
      <div className="ms-2 sm:ms-3 shrink-0 font-bold tabular-nums text-xs sm:text-sm text-[hsl(var(--fg-primary))]">
        {format(inv.total)}
      </div>
    </button>
  )
})
RecentInvoiceRow.displayName = 'RecentInvoiceRow'

// ─── Empty State ───────────────────────────────────────────────────────────

const EmptyInvoices = memo(function EmptyInvoices({
  onCreate,
  t,
}: {
  onCreate: () => void
  t: Translate
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 sm:gap-4 py-6 sm:py-10 text-center">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-[hsl(var(--color-primary)/0.2)] blur-2xl" />
        <div className="relative flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-2xl border border-[hsl(var(--border-default))] bg-gradient-to-br from-[hsl(var(--color-primary)/0.15)] to-[hsl(var(--color-info)/0.15)]">
          <Receipt
            className="size-5 sm:size-7 text-[hsl(var(--color-primary))]"
            aria-hidden="true"
          />
        </div>
      </div>
      <div className="space-y-0.5 sm:space-y-1">
        <p className="text-xs sm:text-sm font-semibold text-[hsl(var(--fg-primary))]">
          {t('dashboard.empty.title')}
        </p>
        <p className="text-[10px] sm:text-sm text-[hsl(var(--fg-secondary))]">
          {t('dashboard.empty.subtitle')}
        </p>
      </div>
      <Button
        type="button"
        onClick={onCreate}
        className="shimmer-btn mt-1 sm:mt-2 inline-flex items-center gap-1.5 sm:gap-2 rounded-xl text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
      >
        <PlusCircle className="size-3.5 sm:size-4" aria-hidden="true" />
        {t('invoices.newinvoices')}
      </Button>
    </div>
  )
})
EmptyInvoices.displayName = 'EmptyInvoices'

// ─── Main Component ──────────────────────────────────────────────────────

export const DashboardInvoices = memo(function DashboardInvoices({
  t,
  invLoading,
  recentInvoices,
  onNavigateInvoice,
  onNavigateQuickInvoice,
  onViewAllInvoices,
}: DashboardInvoicesProps) {
  const { format } = useCurrency()

  if (invLoading) {
    return (
      <div className="space-y-2 sm:space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <InvoiceRowSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (recentInvoices.length === 0) {
    return <EmptyInvoices onCreate={onNavigateQuickInvoice} t={t} />
  }

  return (
    <div className="space-y-2 sm:space-y-3">
      {recentInvoices.map((inv) => (
        <RecentInvoiceRow
          key={inv.id}
          inv={inv}
          onNavigateInvoice={onNavigateInvoice}
          t={t}
          format={format}
        />
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={onViewAllInvoices}
        className="mt-1 sm:mt-2 w-full rounded-xl border-dashed text-xs sm:text-sm h-9 sm:h-10"
        aria-label={t('dashboard.viewAllInvoices')}
      >
        {t('dashboard.viewAllInvoices')}
      </Button>
    </div>
  )
})

DashboardInvoices.displayName = 'DashboardInvoices'
