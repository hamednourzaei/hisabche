'use client'

import { memo, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { EmptyState } from '../empty-state'
import { InvoicesSkeleton } from './invoices-skeleton'
import { Plus, FileText, DollarSign, CheckCircle2, Clock, Download } from 'lucide-react'
import { exportToCSV } from '../../../lib/export'
import { InvoiceRowActions } from './invoice-row-actions'
import { BentoStats, type BentoStat } from '../bento-stats'
import { DataTable, type TableColumn } from '../data-table'
import type { Invoice } from '../../../lib/invoices/invoices-types'

/* ═══════════════════════════════════════════════════════════════════════════
   InvoicesView v3 — shared DataTable · collapsible search · column settings
   ═══════════════════════════════════════════════════════════════════════════ */

interface InvoicesViewProps {
  t: (key: string, fallback?: string) => string
  invoices: Invoice[]
  /** All invoices matching the filter — the stat cards must not be paginated. */
  statsInvoices: Invoice[]
  isLoading: boolean
  total: number
  searchValue: string
  filters: { page: number; limit: number }
  onSearchChange: (value: string) => void
  onPageChange: (page: number) => void
  onNavigateInvoice: (id: string) => void
  onNavigateInvoiceAction: (id: string, action: 'pdf' | 'print' | 'png') => void
  onNewInvoice: () => void
  onDeleteInvoice: (id: string) => void
  statusVariant: (status: string) => 'success' | 'warning' | 'destructive' | 'secondary'
  /** Filters on the canonical `invoice.type`, never on display text. */
  typeFilter?: InvoiceTypeFilter | undefined
  onTypeFilterChange?: ((value: InvoiceTypeFilter) => void) | undefined
}

export type InvoiceTypeFilter = 'all' | 'sale' | 'purchase'

const statusBadgeStyles: Record<string, string> = {
  success:
    'bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))] border-[hsl(var(--color-success)/0.2)]',
  warning:
    'bg-[hsl(var(--color-warning)/0.12)] text-[hsl(var(--color-warning))] border-[hsl(var(--color-warning)/0.2)]',
  destructive:
    'bg-[hsl(var(--color-destructive)/0.12)] text-[hsl(var(--color-destructive))] border-[hsl(var(--color-destructive)/0.2)]',
  secondary:
    'bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-secondary))] border-[hsl(var(--border-default))]',
}

// ─── آمار (بنتو گرید) ───────────────────────────────────────────────────────

const PAID_STATUSES = new Set(['paid', 'completed'])

/** شماره‌ی ماه نسبی: 0 = ماه جاری، 1 = ماه قبل */
function monthOffset(value: string, now: Date): number | null {
  if (!value) return null
  const d = new Date(value)
  if (isNaN(d.getTime())) return null
  return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
}

/** درصد تغییر؛ null یعنی داده‌ای برای مقایسه نیست */
function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? null : 100
  return ((current - previous) / Math.abs(previous)) * 100
}

function useInvoiceStats(invoices: Invoice[], t: (key: string, fallback?: string) => string) {
  return useMemo<BentoStat[]>(() => {
    const now = new Date()
    const active = invoices.filter((inv) => inv.status !== 'cancelled')
    const inMonth = (offset: number) =>
      active.filter((inv) => monthOffset(inv.isoDate, now) === offset)

    const sum = (list: Invoice[]) => list.reduce((acc, inv) => acc + (inv.total || 0), 0)
    const paid = (list: Invoice[]) => list.filter((inv) => PAID_STATUSES.has(inv.status))
    const pending = (list: Invoice[]) => list.filter((inv) => !PAID_STATUSES.has(inv.status))

    const cur = inMonth(0)
    const prev = inMonth(1)
    const currency = active[0]?.currency || 'AFN'
    const monthly = t('common.vsLastMonth', 'نسبت به ماه قبل')

    // ترتیب کارت‌ها عمداً «مبلغ اول، شمارش دوم» است — مبلغ عدد اصلی کسب‌وکار
    // است و باید اول دیده شود؛ همچنین «در انتظار پرداخت» قبل از «تسویه‌شده»
    // می‌آید چون کار باز است، نه کار تمام‌شده.
    return [
      {
        id: 'amount',
        icon: DollarSign,
        label: t('invoices.totalAmount', 'مجموع مبلغ'),
        amount: sum(active),
        suffix: currency,
        delta: percentChange(sum(cur), sum(prev)),
        deltaLabel: monthly,
      },
      {
        id: 'count',
        icon: FileText,
        label: t('invoices.totalCount', 'تعداد فاکتورها'),
        amount: active.length,
        delta: percentChange(cur.length, prev.length),
        deltaLabel: monthly,
      },
      {
        id: 'pending',
        icon: Clock,
        label: t('invoices.pendingAmount', 'در انتظار پرداخت'),
        amount: sum(pending(active)),
        suffix: currency,
        delta: percentChange(sum(pending(cur)), sum(pending(prev))),
        deltaLabel: monthly,
        invertDelta: true,
      },
      {
        id: 'paid',
        icon: CheckCircle2,
        label: t('invoices.paidAmount', 'تسویه‌شده'),
        amount: sum(paid(active)),
        suffix: currency,
        delta: percentChange(sum(paid(cur)), sum(paid(prev))),
        deltaLabel: monthly,
      },
    ]
  }, [invoices, t])
}

// ─── Sub-components ─────────────────────────────────────────────────────────

/**
 * همه / فروش / خرید. Operates on `invoice.type` — the canonical field — so it
 * keeps working regardless of how the type is labelled in any locale.
 */
const TypeFilter = memo(function TypeFilter({
  t,
  value,
  onChange,
}: {
  t: (key: string, fallback?: string) => string
  value: InvoiceTypeFilter
  onChange?: ((value: InvoiceTypeFilter) => void) | undefined
}) {
  if (!onChange) return null

  const options: { key: InvoiceTypeFilter; label: string }[] = [
    { key: 'all', label: t('invoices.filterAll', 'همه') },
    { key: 'sale', label: t('invoices.type.sale', 'فروش') },
    { key: 'purchase', label: t('invoices.type.purchase', 'خرید') },
  ]

  return (
    <div
      role="radiogroup"
      aria-label={t('invoices.type', 'نوع')}
      className="flex w-fit gap-1 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))] p-1"
    >
      {options.map((option) => {
        const active = value === option.key
        return (
          <button
            key={option.key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.key)}
            className={cn(
              'rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))]',
              active
                ? 'bg-[hsl(var(--color-primary))] text-[hsl(var(--color-primary-fg))]'
                : 'text-[hsl(var(--fg-secondary))] hover:text-[hsl(var(--fg-primary))]',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
})
TypeFilter.displayName = 'TypeFilter'

/**
 * CSV export for the invoice table.
 *
 * The `type` column is exported from the canonical `invoice.type` and
 * localised at the point of export — a purchase must never leave the product
 * labelled "sale". Exports what is currently filtered, which is what the user
 * can see.
 */
const ExportButton = memo(function ExportButton({
  t,
  invoices,
}: {
  t: (key: string, fallback?: string) => string
  invoices: Invoice[]
}) {
  const handleExport = () => {
    if (invoices.length === 0) return

    const rows = invoices.map((inv) => ({
      ...inv,
      typeLabel: t(`invoices.type.${inv.type || 'sale'}`, inv.type || 'sale'),
    }))

    exportToCSV(
      rows,
      [
        { key: 'typeLabel', label: t('invoices.type', 'نوع') },
        { key: 'invoiceNumber', label: t('invoices.invoiceNumber', 'شماره فاکتور') },
        { key: 'date', label: t('invoices.date', 'تاریخ') },
        { key: 'customerName', label: t('invoices.customer', 'مشتری') },
        { key: 'company', label: t('invoices.company', 'شرکت') },
        { key: 'total', label: t('invoices.total', 'مبلغ') },
        { key: 'currency', label: t('invoices.currency', 'ارز') },
        { key: 'status', label: t('invoices.status', 'وضعیت') },
        { key: 'paymentDate', label: t('invoices.paymentDate', 'تاریخ تسویه') },
      ],
      `invoices-${new Date().toISOString().split('T')[0]}`,
    )
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={invoices.length === 0}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors',
        'border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))]',
        'hover:text-[hsl(var(--fg-primary))] hover:border-[hsl(var(--border-strong))]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))]',
        'disabled:opacity-40 disabled:cursor-not-allowed',
      )}
    >
      <Download className="size-4" aria-hidden="true" />
      {t('common.export', 'خروجی CSV')}
    </button>
  )
})
ExportButton.displayName = 'ExportButton'

const InvoicesHeader = memo(function InvoicesHeader({
  t,
  onNewInvoice,
}: {
  t: (key: string, fallback?: string) => string
  onNewInvoice: () => void
}) {
  return (
    // Title and action stay on one row at every width — on mobile the button
    // sits opposite the title rather than pushing the table down.
    <div className="flex flex-row items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <h1 className="truncate text-xl font-bold sm:text-2xl lg:text-3xl text-[hsl(var(--fg-primary))]">
          {t('nav.getPaid', 'دریافت پول')}
        </h1>
        <p className="text-xs sm:text-sm text-[hsl(var(--fg-secondary))]">
          {t('nav.getPaid_description', 'چه کسی چقدر باید بپردازد')}
        </p>
      </div>

      <button
        type="button"
        onClick={onNewInvoice}
        className={cn(
          'inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-4 sm:px-5',
          'min-h-[44px] sm:min-h-[40px]',
          'text-sm font-bold text-white',
          'bg-[hsl(var(--color-primary))]',
          'shadow-sm shadow-[hsl(var(--color-primary)/0.15)]',
          'transition-all duration-200',
          'hover:brightness-110 active:scale-[0.98]',
          'focus-visible:ring-4 focus-visible:ring-[rgba(18,200,160,0.18)] focus-visible:outline-none',
          'motion-reduce:transition-none motion-reduce:active:scale-100',
        )}
      >
        <Plus className="size-4 sm:size-[18px]" aria-hidden="true" />
        <span className="whitespace-nowrap">{t('invoices.newinvoices', 'فاکتور جدید')}</span>
      </button>
    </div>
  )
})
InvoicesHeader.displayName = 'InvoicesHeader'

const PaginationControls = memo(function PaginationControls({
  t,
  page,
  totalPages,
  onPageChange,
}: {
  t: (key: string, fallback?: string) => string
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}) {
  const buttonClass = cn(
    'inline-flex items-center justify-center rounded-full px-4',
    'min-h-[44px] sm:min-h-[40px]',
    'text-sm font-medium',
    'border border-[hsl(var(--border-default))]',
    'text-[hsl(var(--fg-secondary))]',
    'hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]',
    'disabled:opacity-30 disabled:cursor-not-allowed',
    'transition-colors duration-150 motion-reduce:transition-none',
    'focus-visible:ring-4 focus-visible:ring-[rgba(18,200,160,0.18)] focus-visible:outline-none',
  )

  return (
    <div
      className={cn(
        'flex items-center justify-center gap-2 sm:gap-3 pt-4',
        'sticky bottom-0 pb-2 sm:pb-0',
        'bg-[hsl(var(--surface-base)/0.95)] backdrop-blur-sm sm:bg-transparent sm:backdrop-blur-none',
      )}
    >
      <button
        type="button"
        disabled={page === 1}
        onClick={() => onPageChange(page - 1)}
        className={buttonClass}
      >
        {t('action.previous', 'قبلی')}
      </button>

      <span className="text-sm tabular-nums text-[hsl(var(--fg-secondary))] min-w-[60px] text-center">
        {page} / {totalPages}
      </span>

      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className={buttonClass}
      >
        {t('action.next', 'بعدی')}
      </button>
    </div>
  )
})
PaginationControls.displayName = 'PaginationControls'

// ─── Columns ────────────────────────────────────────────────────────────────

function useInvoiceColumns(
  t: (key: string, fallback?: string) => string,
  statusVariant: InvoicesViewProps['statusVariant'],
  onNavigateInvoice: (id: string) => void,
  onNavigateInvoiceAction: (id: string, action: 'pdf' | 'print' | 'png') => void,
  onDeleteInvoice: (id: string) => void,
): TableColumn<Invoice>[] {
  return useMemo(
    () => [
      {
        id: 'status',
        labelKey: 'invoices.status',
        labelFallback: 'وضعیت',
        sortValue: (inv) => inv.status,
        render: (inv) => (
          <span
            className={cn(
              'inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold',
              statusBadgeStyles[statusVariant(inv.status)] ?? statusBadgeStyles.secondary,
            )}
          >
            {t(`invoices.${inv.status}`, inv.status)}
          </span>
        ),
      },
      {
        id: 'type',
        labelKey: 'invoices.type',
        labelFallback: 'نوع',
        showFrom: 'md',
        sortValue: (inv) => inv.type,
        render: (inv) => (
          <span className="text-[hsl(var(--fg-secondary))]">
            {t(`invoices.type.${inv.type}`, inv.type)}
          </span>
        ),
      },
      {
        id: 'invoiceNumber',
        labelKey: 'invoices.invoiceNumber',
        labelFallback: 'فاکتور',
        locked: true,
        sortValue: (inv) => inv.invoiceNumber,
        render: (inv) => (
          <span className="font-medium text-[hsl(var(--fg-primary))]">#{inv.invoiceNumber}</span>
        ),
      },
      {
        id: 'createdAt',
        labelKey: 'invoices.createdAt',
        labelFallback: 'ثبت شده',
        showFrom: 'md',
        sortValue: (inv) => inv.isoDate,
        render: (inv) => <span className="text-[hsl(var(--fg-secondary))]">{inv.createdAt}</span>,
      },
      {
        id: 'customerName',
        labelKey: 'invoices.customerName',
        labelFallback: 'خریدار',
        sortValue: (inv) => inv.customerName ?? '',
        render: (inv) => (
          <span className="text-[hsl(var(--fg-primary))]">{inv.customerName || '—'}</span>
        ),
      },
      {
        id: 'company',
        labelKey: 'invoices.company',
        labelFallback: 'شرکت',
        showFrom: 'lg',
        sortValue: (inv) => inv.company ?? '',
        render: (inv) => (
          <span className="text-[hsl(var(--fg-tertiary))]">{inv.company || ''}</span>
        ),
      },
      {
        id: 'total',
        labelKey: 'invoices.total',
        labelFallback: 'مجموع',
        align: 'end',
        sortValue: (inv) => inv.total,
        render: (inv) => (
          <span className="font-semibold tabular-nums text-[hsl(var(--fg-primary))]">
            {inv.total.toLocaleString()} {inv.currency}
          </span>
        ),
      },
      {
        id: 'paymentDate',
        labelKey: 'invoices.paymentDate',
        labelFallback: 'تاریخ تسویه',
        showFrom: 'lg',
        sortValue: (inv) => inv.paymentDate ?? null,
        render: (inv) => (
          <span className="text-[hsl(var(--fg-secondary))]">{inv.paymentDate || '—'}</span>
        ),
      },
      {
        id: 'itemsSent',
        labelKey: 'invoices.itemsSent',
        labelFallback: 'ارسال‌شده',
        showFrom: 'md',
        align: 'end',
        sortValue: (inv) => inv.itemsSent,
        render: (inv) => (
          <span className="tabular-nums text-[hsl(var(--fg-secondary))]">{inv.itemsSent}</span>
        ),
      },
      {
        id: 'actions',
        labelKey: 'invoices.actions',
        labelFallback: 'عملیات',
        locked: true,
        align: 'end',
        render: (inv) => (
          <div onClick={(event) => event.stopPropagation()}>
            <InvoiceRowActions
              inv={inv}
              t={t}
              onNavigate={onNavigateInvoice}
              onNavigateAction={onNavigateInvoiceAction}
              onDelete={onDeleteInvoice}
            />
          </div>
        ),
      },
    ],
    [onDeleteInvoice, onNavigateInvoice, onNavigateInvoiceAction, statusVariant, t],
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export const InvoicesView = memo(function InvoicesView({
  t,
  invoices,
  statsInvoices,
  isLoading,
  total,
  searchValue,
  filters,
  onSearchChange,
  onPageChange,
  onNavigateInvoice,
  onNavigateInvoiceAction,
  onNewInvoice,
  onDeleteInvoice,
  statusVariant,
  typeFilter = 'all',
  onTypeFilterChange,
}: InvoicesViewProps) {
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / filters.limit)),
    [total, filters.limit],
  )

  const stats = useInvoiceStats(statsInvoices, t)
  const columns = useInvoiceColumns(
    t,
    statusVariant,
    onNavigateInvoice,
    onNavigateInvoiceAction,
    onDeleteInvoice,
  )

  if (isLoading) {
    return <InvoicesSkeleton />
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <InvoicesHeader t={t} onNewInvoice={onNewInvoice} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <TypeFilter t={t} value={typeFilter} onChange={onTypeFilterChange} />
        <ExportButton t={t} invoices={statsInvoices} />
      </div>

      {statsInvoices.length > 0 && <BentoStats t={t} stats={stats} />}

      <DataTable
        tableId="invoices"
        t={t}
        rows={invoices}
        columns={columns}
        rowKey={(inv) => inv.id}
        onRowClick={(inv) => onNavigateInvoice(inv.id)}
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        minWidthClass="min-w-[420px] sm:min-w-[720px]"
        emptyState={
          <EmptyState
            icon="invoice"
            title={t('invoices.noinvoicess', 'هیچ فاکتوری یافت نشد')}
            description={t('invoices.noinvoicessDesc', 'هنوز هیچ فاکتوری ثبت نشده است.')}
            action={{
              label: t('invoices.newinvoices', 'فاکتور جدید'),
              onClick: onNewInvoice,
            }}
          />
        }
      />

      {total > filters.limit && (
        <PaginationControls
          t={t}
          page={filters.page}
          totalPages={totalPages}
          onPageChange={onPageChange}
        />
      )}
    </div>
  )
})

InvoicesView.displayName = 'InvoicesView'
