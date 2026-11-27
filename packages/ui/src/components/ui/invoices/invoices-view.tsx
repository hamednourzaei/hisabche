'use client'

// ============================================
// packages/ui/src/components/ui/invoices/invoices-view.tsx
//
// The invoice-management table.
//
// ⚠️ ONE TABLE FOR FOUR DOCUMENT KINDS. Sales and purchases come from
// `invoices`; pre-sales and pre-purchases are advances (`order_deposits`).
// They are read into one row shape (`invoice-list-row.ts`) so the user
// searches, sorts and opens one list — the page does not swap a second table
// in for the advance filters any more.
//
// The three page filters are groups (همه · خرید و فروش · پیش‌خرید و پیش‌فروش),
// not five document-type tabs. `?type=sale|purchase|pre_sale|pre_purchase`
// still opens the right group; the mapping lives in `filterFromLegacyType`.
// ============================================

import { useNumberFormat } from '../../../hooks/use-number-format'
import { useIntlLocale } from '../../../hooks/use-intl-locale'
import { SegmentedControl } from '../segmented-control'
import { INVOICE_STATUS_FILTERS } from '../../../lib/invoices/invoices-format'
import { memo, useCallback, useEffect, useMemo, type ReactNode } from 'react'
import { cn } from '../../../lib/utils'
import { FOCUS_RING } from '../focus-ring'
import { EmptyState } from '../empty-state'
import { InvoicesSkeleton } from './invoices-skeleton'
import { CreditStatusBadge } from './credit-status-badge'
import {
  FileText,
  DollarSign,
  CheckCircle2,
  Clock,
  Download,
  Trash2,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import { exportToCSV } from '../../../lib/export'
import { csvFilename } from '@hisabche/formatting'
import {
  INVOICE_EXPORT_COLUMNS,
  invoiceTypeLabelKey,
  resolveExportColumns,
} from '@hisabche/ui-contract'
import { InvoiceRowActions, AdvanceRowActions } from './invoice-row-actions'
import { NewInvoiceChooser, type NewDocumentKind } from './new-invoice-chooser'
import { InvoiceDraftsButton } from './invoice-drafts-button'
import { formatPercent, valueFontClass } from '../kpi-card'
import { BentoStats, fullAmount, type BentoStat } from '../bento-stats'
import { Money } from '../capability/capability-kit'
import type { InvoiceListSummary } from '@hisabche/api'
import {
  BulkActionBar,
  DataTable,
  TableFilterMenu,
  useBulkAction,
  useRowSelection,
  type TableColumn,
} from '../data-table'
import type { Invoice } from '../../../lib/invoices/invoices-types'
import { partyLabel } from '../../../lib/anonymous-party'
import { useDateFormat } from '../../../hooks/use-date-format'
import {
  ADVANCE_STATUS_FILTERS,
  advanceStatusMatches,
  type AdvanceStatusFilter,
  type InvoiceListRow,
  type InvoicePageFilter,
} from '../../../lib/invoices/invoice-list-row'
/* ═══════════════════════════════════════════════════════════════════════════
   InvoicesView v4 — one table · three page filters · invoice + advance rows
   ═══════════════════════════════════════════════════════════════════════════ */

interface InvoicesViewProps {
  t: (key: string, fallback?: string) => string
  invoices: Invoice[]
  /**
   * One server page (at most 100 rows) of invoices matching the search — used
   * for the CSV export only. Never reduce it into a figure; use `statsSummary`.
   */
  statsInvoices: Invoice[]
  /** Stat-card figures over EVERY matching invoice, from the server. */
  statsSummary: InvoiceListSummary | null
  isLoading: boolean
  total: number
  searchValue: string
  filters: { page: number; limit: number }
  onSearchChange: (value: string) => void
  onPageChange: (page: number) => void
  onNavigateInvoice: (id: string) => void
  /** H2 — open the party behind an invoice. Optional: a renderer that has no
   *  customer route passes nothing and the name stays plain text. */
  onNavigateParty?: ((id: string) => void) | undefined
  onNavigateInvoiceAction: (id: string, action: 'pdf' | 'print' | 'png') => void
  onNewInvoice: () => void
  /** The «new invoice» chooser: sale, purchase, pre-sale or pre-purchase. */
  onNewDocument: (kind: NewDocumentKind) => void
  /** Advance documents, already mapped to the shared row shape. */
  advanceRows: InvoiceListRow[]
  advancesLoading: boolean
  advancesError: boolean
  /** Rendered beside the export button (the recurring-invoices entry). */
  toolbarExtra?: ReactNode
  /**
   * Returns a promise so bulk delete can await each call and report which
   * invoices actually went. A `void` signature would make every item look
   * successful the instant it was dispatched.
   */
  onDeleteInvoice: (id: string) => void | Promise<void>
  statusVariant: (status: string) => 'success' | 'warning' | 'destructive' | 'secondary'
  /** The three page groups. */
  typeFilter?: InvoicePageFilter | undefined
  onTypeFilterChange?: ((value: InvoicePageFilter) => void) | undefined
  /** `'all'`, or one of `INVOICE_STATUS_FILTERS`. Applies to invoices. */
  statusFilter?: string | undefined
  onStatusFilterChange?: ((value: string) => void) | undefined
  /** `'all'`, or one of `ADVANCE_STATUS_FILTERS`. Applies to advances. */
  advanceStatusFilter?: AdvanceStatusFilter | undefined
  onAdvanceStatusFilterChange?: ((value: AdvanceStatusFilter) => void) | undefined
  /**
   * The places an invoice can belong to. A filter is offered only for a list
   * that has something to choose from — a business with no branches sees none.
   */
  branches?: readonly InvoicePlaceOption[] | undefined
  branchFilter?: string | undefined
  onBranchFilterChange?: ((value: string) => void) | undefined
  warehouses?: readonly InvoicePlaceOption[] | undefined
  warehouseFilter?: string | undefined
  onWarehouseFilterChange?: ((value: string) => void) | undefined
}

export interface InvoicePlaceOption {
  id: string
  name: string
}

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

/** درصد تغییر؛ null یعنی داده‌ای برای مقایسه نیست */
function percentChange(current: number, previous: number): number | null {
  // Nothing last month is not «+100%»: there is no base to compare against,
  // so the badge is absent (QA-PCT-001).
  if (previous === 0) return null
  return ((current - previous) / Math.abs(previous)) * 100
}

/**
 * The stat cards read the server's summary — computed over EVERY invoice that
 * matches the search — never a reduction of a fetched page. They used to sum
 * `statsInvoices`, which the route caps at 100 rows however many were asked
 * for, so a business with more invoices saw its latest hundred as its total.
 */
function useInvoiceStats(
  summary: InvoiceListSummary | null,
  t: (key: string, fallback?: string) => string,
) {
  return useMemo<BentoStat[]>(() => {
    if (!summary) return []
    const { currentMonth: cur, previousMonth: prev } = summary
    // Amounts are not converted between currencies. A suffix is only honest
    // when every counted invoice is in the same one.
    const suffix = summary.currencies.length === 1 ? summary.currencies[0] : undefined
    const withSuffix = suffix ? { suffix } : {}
    const monthly = t('common.vsLastMonth', 'نسبت به ماه قبل')

    // ترتیب کارت‌ها عمداً «مبلغ اول، شمارش دوم» است — مبلغ عدد اصلی کسب‌وکار
    // است و باید اول دیده شود؛ همچنین «در انتظار پرداخت» قبل از «تسویه‌شده»
    // می‌آید چون کار باز است، نه کار تمام‌شده.
    return [
      {
        id: 'amount',
        icon: DollarSign,
        label: t('invoices.totalAmount', 'مجموع مبلغ'),
        amount: summary.totalAmount,
        ...withSuffix,
        delta: percentChange(cur.totalAmount, prev.totalAmount),
        deltaLabel: monthly,
      },
      {
        id: 'count',
        icon: FileText,
        label: t('invoices.totalCount', 'تعداد فاکتورها'),
        amount: summary.count,
        delta: percentChange(cur.count, prev.count),
        deltaLabel: monthly,
      },
      {
        id: 'pending',
        icon: Clock,
        label: t('invoices.pendingAmount', 'در انتظار پرداخت'),
        amount: summary.pendingAmount,
        ...withSuffix,
        delta: percentChange(cur.pendingAmount, prev.pendingAmount),
        deltaLabel: monthly,
        invertDelta: true,
      },
      {
        id: 'paid',
        icon: CheckCircle2,
        label: t('invoices.paidAmount', 'تسویه‌شده'),
        amount: summary.paidAmount,
        ...withSuffix,
        delta: percentChange(cur.paidAmount, prev.paidAmount),
        deltaLabel: monthly,
      },
    ]
  }, [summary, t])
}

// ─── Sub-components ─────────────────────────────────────────────────────────

/**
 * The three groups. `trading` shows sale + purchase in one table; `advances`
 * shows pre-sale + pre-purchase. It never opens a second table.
 */
const TypeFilter = memo(function TypeFilter({
  t,
  value,
  onChange,
}: {
  t: (key: string, fallback?: string) => string
  value: InvoicePageFilter
  onChange?: ((value: InvoicePageFilter) => void) | undefined
}) {
  if (!onChange) return null

  const options: { key: InvoicePageFilter; label: string }[] = [
    { key: 'all', label: t('invoices.filterAll', 'همه') },
    { key: 'trading', label: t('invoices.filterTrading', 'خرید و فروش') },
    { key: 'advances', label: t('invoices.filterAdvances', 'پیش‌خرید و پیش‌فروش') },
  ]

  return (
    <SegmentedControl
      label={t('invoices.typeLabel', 'نوع')}
      options={options.map((option) => ({ value: option.key, label: option.label }))}
      value={value}
      onChange={onChange}
      branch
    />
  )
})
TypeFilter.displayName = 'TypeFilter'

/**
 * CSV export for the invoice table.
 *
 * The `type` column is exported from the canonical `invoice.type` and
 * localised at the point of export — a purchase must never leave the product
 * labelled "sale". Exports what is currently filtered, which is what the user
 * can see. Advances are not invoices and are not exported here.
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

    // Columns come from the shared contract so the mobile export cannot drift
    // into a different set or a different heading for the same field.
    const rows = invoices.map((inv) => ({
      ...inv,
      typeLabel: t(invoiceTypeLabelKey(inv.type), inv.type || 'sale'),
    }))

    exportToCSV(
      rows,
      resolveExportColumns<(typeof rows)[number]>(INVOICE_EXPORT_COLUMNS, t),
      csvFilename('invoices', new Date()),
    )
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={invoices.length === 0}
      className={cn(
        'inline-flex min-h-[44px] sm:min-h-[36px] items-center gap-1.5 rounded-xl border px-3 text-xs sm:text-sm font-medium transition-colors',
        'border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] text-[hsl(var(--fg-secondary))]',
        'hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]',
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
  onNewDocument,
}: {
  t: (key: string, fallback?: string) => string
  onNewDocument: (kind: NewDocumentKind) => void
}) {
  return (
    <div
      className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
      data-guide="invoices-create"
    >
      <div className="min-w-0">
        <h1 className="truncate text-lg font-bold sm:text-xl text-[hsl(var(--fg-primary))]">
          {t('nav.getPaid')}
        </h1>
        <p className="mt-0.5 text-xs sm:text-sm text-[hsl(var(--fg-secondary))]">
          {t('nav.getPaid_description')}
        </p>
      </div>

      <div className="flex flex-wrap shrink-0 items-center gap-2">
        <InvoiceDraftsButton t={t} />
        <NewInvoiceChooser t={t} onChoose={onNewDocument} />
      </div>
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
    FOCUS_RING,
  )

  return (
    <div
      // Under the table, not sticky: stuck to the bottom it floated over the
      // invoice cards on a phone and covered the row being read.
      className="flex items-center justify-center gap-2 pt-4 pb-2 sm:gap-3 sm:pb-0"
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
  onDeleteInvoice: InvoicesViewProps['onDeleteInvoice'],
  onNavigateParty: InvoicesViewProps['onNavigateParty'],
): TableColumn<InvoiceListRow>[] {
  const fmtNum = useNumberFormat()
  const dates = useDateFormat()
  return useMemo(
    () => [
      {
        id: 'status',
        labelKey: 'invoices.status',
        labelFallback: 'وضعیت',
        sortValue: (row) => (row.rowType === 'invoice' ? row.invoice.status : row.advance.status),
        render: (row) =>
          row.rowType === 'invoice' ? (
            <span className="inline-flex flex-wrap items-center gap-1">
              <span
                className={cn(
                  'inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold',
                  statusBadgeStyles[statusVariant(row.invoice.status)] ??
                    statusBadgeStyles.secondary,
                )}
              >
                {t(`invoices.${row.invoice.status}`, row.invoice.status)}
              </span>
              {/* V53 OD-3: an unapproved credit sale is not final — say so beside the status. */}
              <CreditStatusBadge status={row.invoice.creditStatus} t={t} />
            </span>
          ) : (
            <span
              className={cn(
                'inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold',
                row.advance.appliedInvoiceId
                  ? statusBadgeStyles.success
                  : row.advance.postingStatus === 'pending_posting'
                    ? statusBadgeStyles.warning
                    : statusBadgeStyles.secondary,
              )}
            >
              {row.advance.appliedInvoiceId
                ? t('invoices.finalized', 'نهایی‌شده')
                : row.advance.postingStatus === 'pending_posting'
                  ? t('invoices.pending', 'تأییدنشده')
                  : t('invoices.draft', 'پیش‌نویس')}
            </span>
          ),
      },
      {
        id: 'customerName',
        // The list mixes sales and purchases, so one column header cannot say
        // "خریدار" — on a purchase row that party is the seller. The neutral
        // «طرف حساب» is correct for both; the per-row direction is already
        // carried by the type column beside it.
        labelKey: 'invoices.party',
        labelFallback: 'طرف حساب',
        sortValue: (row) =>
          row.rowType === 'invoice' ? (row.invoice.customerName ?? '') : (row.partyName ?? ''),
        // H2 — the party's name reaches the party.
        //
        // A link ONLY when there is an id to go to. A walk-in cash sale has a
        // name and no customer record; rendering it as a link would send the
        // user to a page that does not exist, which is worse than plain text.
        render: (row) => {
          const id =
            row.rowType === 'invoice'
              ? row.invoice.type === 'purchase'
                ? row.invoice.supplierId || row.invoice.customerId
                : row.invoice.customerId
              : row.advance.supplierId || row.advance.customerId
          const name = row.rowType === 'invoice' ? row.invoice.customerName : row.partyName
          if (id && name) {
            return (
              <button
                type="button"
                // The row itself opens the invoice. Without this the click
                // bubbles and the user lands on the invoice they were trying to
                // navigate AWAY from.
                onClick={(event) => {
                  event.stopPropagation()
                  onNavigateParty?.(id)
                }}
                className="text-start font-medium text-[hsl(var(--color-primary))] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))] rounded"
              >
                {name}
              </button>
            )
          }
          if (row.rowType === 'invoice') {
            // ⚠️ One fact, one wording. A walk-in sale has no customer and
            // the product said so four different ways — see `anonymous-party.ts`.
            return (
              <span className="font-medium text-[hsl(var(--fg-primary))]">
                {partyLabel(row.invoice.customerId, row.invoice.customerName, t)}
              </span>
            )
          }
          // An advance always has a party; an unreadable name must not become
          // «مشتری نقدی» — unknown is not anonymous.
          return (
            <span className="text-[hsl(var(--fg-tertiary))]">
              {t('advances.unknownParty', 'نام طرف حساب خوانده نشد')}
            </span>
          )
        },
      },
      {
        id: 'invoiceNumber',
        labelKey: 'invoices.invoiceNumber',
        labelFallback: 'فاکتور',
        locked: true,
        sortValue: (row) =>
          row.rowType === 'invoice' ? row.invoice.invoiceNumber : row.advance.id,
        render: (row) =>
          row.rowType === 'invoice' ? (
            <span className="font-medium tabular-nums text-[hsl(var(--fg-primary))]">
              #{row.invoice.invoiceNumber}
            </span>
          ) : (
            // An advance has no human number yet. The id is shown short and
            // complete on hover; inventing a number would not resolve to a row.
            <span
              className="font-mono text-xs text-[hsl(var(--fg-secondary))]"
              title={row.advance.id}
            >
              #{row.advance.id.slice(0, 8)}
            </span>
          ),
      },
      {
        id: 'total',
        labelKey: 'invoices.total',
        labelFallback: 'مجموع',
        align: 'end',
        sortValue: (row) =>
          row.rowType === 'invoice'
            ? row.invoice.total
            : (row.advance.document?.totalMinor ?? row.advance.amountMinor),
        render: (row) =>
          row.rowType === 'invoice' ? (
            <span className="font-semibold tabular-nums text-[hsl(var(--fg-primary))]">
              {fmtNum(row.invoice.total)}{' '}
              <span className="text-xs font-normal text-[hsl(var(--fg-tertiary))]">
                {row.invoice.currency}
              </span>
            </span>
          ) : (
            <span className="inline-flex flex-col items-end gap-0.5">
              <Money
                minor={row.advance.document?.totalMinor ?? row.advance.amountMinor}
                currency={row.advance.currency ?? undefined}
              />
              <span className="text-[11px] tabular-nums text-[hsl(var(--fg-tertiary))]">
                {t('advances.amount', 'پیش‌پرداخت')}:{' '}
                <Money
                  minor={row.advance.amountMinor}
                  currency={row.advance.currency ?? undefined}
                />
              </span>
            </span>
          ),
      },
      {
        id: 'type',
        labelKey: 'invoices.cols.type',
        labelFallback: 'نوع',
        showFrom: 'md',
        sortValue: (row) => row.kind,
        render: (row) => (
          <span className="inline-flex items-center rounded-md bg-[hsl(var(--surface-muted))] px-2 py-0.5 text-xs font-medium text-[hsl(var(--fg-secondary))]">
            {row.rowType === 'invoice'
              ? t(`invoices.type.${row.kind}`, row.kind)
              : t(
                  row.kind === 'pre_sale'
                    ? 'advances.sections.preSale'
                    : 'advances.sections.prePurchase',
                  row.kind,
                )}
          </span>
        ),
      },
      {
        id: 'createdAt',
        labelKey: 'invoices.createdAt',
        labelFallback: 'ثبت شده',
        showFrom: 'md',
        sortValue: (row) =>
          row.rowType === 'invoice' ? row.invoice.isoDate : row.advance.createdAt,
        render: (row) => (
          <span className="tabular-nums text-[hsl(var(--fg-secondary))]">
            {row.rowType === 'invoice' ? row.invoice.createdAt : dates.date(row.advance.createdAt)}
          </span>
        ),
      },
      {
        id: 'company',
        labelKey: 'invoices.cols.company',
        labelFallback: 'شرکت',
        showFrom: 'lg',
        sortValue: (row) => (row.rowType === 'invoice' ? (row.invoice.company ?? '') : ''),
        render: (row) => (
          <span className="text-[hsl(var(--fg-tertiary))]">
            {row.rowType === 'invoice' ? row.invoice.company || '—' : '—'}
          </span>
        ),
      },
      {
        id: 'paymentDate',
        labelKey: 'invoices.paymentDate',
        labelFallback: 'تاریخ تسویه',
        showFrom: 'lg',
        sortValue: (row) => (row.rowType === 'invoice' ? (row.invoice.paymentDate ?? null) : null),
        render: (row) => (
          <span className="text-[hsl(var(--fg-secondary))]">
            {row.rowType === 'invoice' ? row.invoice.paymentDate || '—' : '—'}
          </span>
        ),
      },
      {
        id: 'itemsSent',
        labelKey: 'invoices.cols.itemsSent',
        labelFallback: 'ارسال‌شده',
        showFrom: 'md',
        align: 'end',
        sortValue: (row) => (row.rowType === 'invoice' ? row.invoice.itemsSent : null),
        render: (row) => (
          <span className="tabular-nums text-[hsl(var(--fg-secondary))]">
            {row.rowType === 'invoice' ? row.invoice.itemsSent : '—'}
          </span>
        ),
      },
      {
        id: 'actions',
        labelKey: 'invoices.actions',
        labelFallback: 'عملیات',
        locked: true,
        align: 'end',
        render: (row) => (
          <div onClick={(event) => event.stopPropagation()}>
            {row.rowType === 'invoice' ? (
              <InvoiceRowActions
                inv={row.invoice}
                t={t}
                onNavigate={onNavigateInvoice}
                onNavigateAction={onNavigateInvoiceAction}
                onDelete={onDeleteInvoice}
              />
            ) : (
              <AdvanceRowActions
                target={row}
                t={t}
                onOpenParty={onNavigateParty}
                onOpenInvoice={onNavigateInvoice}
              />
            )}
          </div>
        ),
      },
    ],
    [
      dates,
      fmtNum,
      onDeleteInvoice,
      onNavigateInvoice,
      onNavigateInvoiceAction,
      onNavigateParty,
      statusVariant,
      t,
    ],
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export const InvoicesView = memo(function InvoicesView({
  t,
  invoices,
  statsInvoices,
  statsSummary,
  isLoading,
  total,
  searchValue,
  filters,
  onSearchChange,
  onPageChange,
  onNavigateInvoice,
  onNavigateParty,
  onNavigateInvoiceAction,
  onNewInvoice,
  onNewDocument,
  advanceRows,
  advancesLoading,
  advancesError,
  toolbarExtra,
  onDeleteInvoice,
  statusVariant,
  typeFilter = 'all',
  onTypeFilterChange,
  statusFilter = 'all',
  onStatusFilterChange,
  advanceStatusFilter = 'all',
  onAdvanceStatusFilterChange,
  branches = [],
  branchFilter = 'all',
  onBranchFilterChange,
  warehouses = [],
  warehouseFilter = 'all',
  onWarehouseFilterChange,
}: InvoicesViewProps) {
  const locale = useIntlLocale()
  const fmtNum = useNumberFormat()

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / filters.limit)),
    [total, filters.limit],
  )

  const stats = useInvoiceStats(statsSummary, t)
  const columns = useInvoiceColumns(
    t,
    statusVariant,
    onNavigateInvoice,
    onNavigateInvoiceAction,
    onDeleteInvoice,
    onNavigateParty,
  )

  const showInvoices = typeFilter !== 'advances'
  const showAdvances = typeFilter !== 'trading'

  const visibleAdvances = useMemo(
    () =>
      advanceRows.filter(
        (row) =>
          row.rowType === 'advance' && advanceStatusMatches(row.advance, advanceStatusFilter),
      ),
    [advanceRows, advanceStatusFilter],
  )

  const unpostedAdvancesCount = useMemo(
    () =>
      visibleAdvances.filter(
        (row) =>
          row.rowType === 'advance' &&
          (row.advance.status === 'pending_posting' || row.advance.status === 'posting_unknown'),
      ).length,
    [visibleAdvances],
  )

  /**
   * Invoices keep the server page; advances have no server paging and are a
   * short list. They are shown as rows of the SAME table, in their own block.
   */
  const rows = useMemo<InvoiceListRow[]>(() => {
    const invoiceList = showInvoices ? invoices.map(toInvoiceListRow) : []
    if (!showAdvances) return invoiceList
    return [...visibleAdvances, ...invoiceList]
  }, [showAdvances, showInvoices, invoices, visibleAdvances])

  // ─── Bulk delete ───
  // There is no bulk endpoint; this reuses the same per-invoice delete the row
  // menu calls, so authorization and side effects (stock, ledger) are identical.
  //
  // ⚠️ Selection is offered only in the invoices-only group. With advances in
  // the table, the selected ids would mix two delete semantics, and «حذف» on
  // an advance id would call the invoice endpoint with a deposit id.
  const selection = useRowSelection()
  const bulkDelete = useBulkAction(
    useCallback(async (id: string) => onDeleteInvoice(id), [onDeleteInvoice]),
  )

  const invoiceIds = useMemo(
    () => (typeFilter === 'trading' ? invoices.map((inv) => inv.id) : []),
    [invoices, typeFilter],
  )

  // Rows that vanished (deleted, filtered out, paged away) must not stay
  // selected — a later action would target ids that are no longer listed.
  useEffect(() => {
    selection.prune(invoiceIds)
  }, [invoiceIds, selection])

  const handleBulkDelete = useCallback(async () => {
    await bulkDelete.run([...selection.selectedIds])
    selection.clear()
  }, [bulkDelete, selection])

  if (typeFilter !== 'advances' && isLoading) {
    return <InvoicesSkeleton />
  }

  const statusOptions =
    typeFilter === 'advances'
      ? ADVANCE_STATUS_FILTERS.map((value) => ({
          value,
          label: t(`customerDeposits.status.${value}`, value),
        }))
      : INVOICE_STATUS_FILTERS.map((status) => ({
          value: status,
          label: t(`invoices.${status}`, status),
        }))

  const statusValue = typeFilter === 'advances' ? advanceStatusFilter : statusFilter
  const onStatusValueChange =
    typeFilter === 'advances'
      ? (value: string) => onAdvanceStatusFilterChange?.(value as AdvanceStatusFilter)
      : onStatusFilterChange

  const collectionRatio =
    statsSummary && statsSummary.totalAmount > 0
      ? Math.min(
          100,
          Math.max(0, Math.round((statsSummary.paidAmount / statsSummary.totalAmount) * 100)),
        )
      : null

  const totalAmountStat = stats.find((s) => s.id === 'amount')
  const countStat = stats.find((s) => s.id === 'count')
  const pendingStat = stats.find((s) => s.id === 'pending')
  const paidStat = stats.find((s) => s.id === 'paid')

  return (
    <div className="space-y-3 sm:space-y-3.5" data-guide="invoices-page">
      <TypeFilter t={t} value={typeFilter} onChange={onTypeFilterChange} />
      <InvoicesHeader t={t} onNewDocument={onNewDocument} />

      {typeFilter === 'advances' ? (
        <section
          aria-label={t('invoices.filterAdvances', 'پیش‌خرید و پیش‌فروش')}
          className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-4 py-2.5"
        >
          <span className="text-xs sm:text-sm font-medium text-[hsl(var(--fg-secondary))]">
            {t('invoices.advancesSummaryCount', '{count} سند پیش‌پرداخت').replace(
              '{count}',
              fmtNum(visibleAdvances.length),
            )}
          </span>
          {unpostedAdvancesCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--color-warning)/0.3)] bg-[hsl(var(--color-warning)/0.12)] px-2.5 py-0.5 text-xs font-semibold tabular-nums text-[hsl(var(--color-warning))]">
              <Clock className="size-3.5" aria-hidden="true" />
              {fmtNum(unpostedAdvancesCount)}{' '}
              {t('invoices.advancesPendingPosting', 'نیازمند ثبت نهایی')}
            </span>
          ) : null}
        </section>
      ) : statsSummary && statsSummary.count > 0 && totalAmountStat ? (
        <section
          aria-label={t('invoices.overviewLabel', 'نمای کلی مالی فاکتورها')}
          className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] overflow-hidden"
        >
          {/* Executive 12-col Financial Ledger Band (88-104px laptop budget, inline ratio meter) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0">
            <div className="lg:col-span-5 min-w-0 px-4 py-3 flex flex-col justify-between gap-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-md bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))]">
                    <DollarSign className="size-3.5" aria-hidden="true" />
                  </span>
                  <span className="truncate text-xs font-medium text-[hsl(var(--fg-secondary))]">
                    {totalAmountStat.label}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {countStat?.amount !== undefined ? (
                    <span className="rounded-full bg-[hsl(var(--surface-muted))] px-2 py-0.5 text-[11px] font-medium tabular-nums text-[hsl(var(--fg-secondary))]">
                      {fullAmount(countStat.amount, locale)} {t('invoices.unitInvoice', 'فاکتور')}
                    </span>
                  ) : null}
                  {totalAmountStat.delta !== undefined && totalAmountStat.delta !== null ? (
                    <span
                      className={cn(
                        'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
                        totalAmountStat.delta >= 0
                          ? 'bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))]'
                          : 'bg-[hsl(var(--color-destructive)/0.12)] text-[hsl(var(--color-destructive))]',
                      )}
                    >
                      {totalAmountStat.delta >= 0 ? (
                        <TrendingUp className="size-3" aria-hidden="true" />
                      ) : (
                        <TrendingDown className="size-3" aria-hidden="true" />
                      )}
                      {formatPercent(totalAmountStat.delta, locale)}
                    </span>
                  ) : null}
                </div>
              </div>

              {(() => {
                const text = fullAmount(totalAmountStat.amount ?? 0, locale)
                return (
                  <p
                    title={totalAmountStat.suffix ? `${text} ${totalAmountStat.suffix}` : text}
                    className={cn(
                      'max-w-full truncate font-bold tabular-nums text-[hsl(var(--fg-primary))]',
                      valueFontClass(text),
                    )}
                  >
                    {text}
                    {totalAmountStat.suffix ? (
                      <span className="ms-1 text-xs font-medium text-[hsl(var(--fg-tertiary))]">
                        {totalAmountStat.suffix}
                      </span>
                    ) : null}
                  </p>
                )
              })()}

              {collectionRatio !== null ? (
                <div className="flex items-center gap-2 pt-0.5">
                  <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-[hsl(var(--fg-secondary))]">
                    <CheckCircle2
                      className="size-3 text-[hsl(var(--color-success))]"
                      aria-hidden="true"
                    />
                    {t('invoices.collectionRate', 'نرخ وصول')}
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[hsl(var(--surface-muted))]">
                    <div
                      className="h-full rounded-full bg-[hsl(var(--color-success))] transition-all duration-300 motion-reduce:transition-none"
                      style={{ width: `${collectionRatio}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-semibold tabular-nums text-[hsl(var(--fg-primary))]">
                    {fmtNum(collectionRatio)}
                    {/^en/i.test(locale) ? '%' : '٪'}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="lg:col-span-7 min-w-0 grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 lg:border-s lg:border-[hsl(var(--border-default)/0.6)]">
              {pendingStat ? (
                <div className="min-w-0 px-4 py-3 flex flex-col justify-between gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--fg-secondary))] min-w-0">
                      <Clock
                        className="size-3.5 shrink-0 text-[hsl(var(--color-warning))]"
                        aria-hidden="true"
                      />
                      <span className="truncate">{pendingStat.label}</span>
                    </div>
                    {pendingStat.delta !== undefined && pendingStat.delta !== null ? (
                      <span
                        className={cn(
                          'inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
                          pendingStat.delta <= 0
                            ? 'bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))]'
                            : 'bg-[hsl(var(--color-destructive)/0.12)] text-[hsl(var(--color-destructive))]',
                        )}
                      >
                        {pendingStat.delta >= 0 ? (
                          <TrendingUp className="size-3" aria-hidden="true" />
                        ) : (
                          <TrendingDown className="size-3" aria-hidden="true" />
                        )}
                        {formatPercent(pendingStat.delta, locale)}
                      </span>
                    ) : null}
                  </div>
                  {(() => {
                    const text = fullAmount(pendingStat.amount ?? 0, locale)
                    return (
                      <p
                        title={pendingStat.suffix ? `${text} ${pendingStat.suffix}` : text}
                        className={cn(
                          'max-w-full truncate font-bold tabular-nums text-[hsl(var(--fg-primary))]',
                          valueFontClass(text),
                        )}
                      >
                        {text}
                        {pendingStat.suffix ? (
                          <span className="ms-1 text-xs font-medium text-[hsl(var(--fg-tertiary))]">
                            {pendingStat.suffix}
                          </span>
                        ) : null}
                      </p>
                    )
                  })()}
                </div>
              ) : null}
              {paidStat ? (
                <div className="min-w-0 px-4 py-3 sm:border-s sm:border-[hsl(var(--border-default)/0.6)] flex flex-col justify-between gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--fg-secondary))] min-w-0">
                      <CheckCircle2
                        className="size-3.5 shrink-0 text-[hsl(var(--color-success))]"
                        aria-hidden="true"
                      />
                      <span className="truncate">{paidStat.label}</span>
                    </div>
                    {paidStat.delta !== undefined && paidStat.delta !== null ? (
                      <span
                        className={cn(
                          'inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
                          paidStat.delta >= 0
                            ? 'bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))]'
                            : 'bg-[hsl(var(--color-destructive)/0.12)] text-[hsl(var(--color-destructive))]',
                        )}
                      >
                        {paidStat.delta >= 0 ? (
                          <TrendingUp className="size-3" aria-hidden="true" />
                        ) : (
                          <TrendingDown className="size-3" aria-hidden="true" />
                        )}
                        {formatPercent(paidStat.delta, locale)}
                      </span>
                    ) : null}
                  </div>
                  {(() => {
                    const text = fullAmount(paidStat.amount ?? 0, locale)
                    return (
                      <p
                        title={paidStat.suffix ? `${text} ${paidStat.suffix}` : text}
                        className={cn(
                          'max-w-full truncate font-bold tabular-nums text-[hsl(var(--fg-primary))]',
                          valueFontClass(text),
                        )}
                      >
                        {text}
                        {paidStat.suffix ? (
                          <span className="ms-1 text-xs font-medium text-[hsl(var(--fg-tertiary))]">
                            {paidStat.suffix}
                          </span>
                        ) : null}
                      </p>
                    )
                  })()}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : statsSummary && statsSummary.count > 0 ? (
        <BentoStats t={t} stats={stats} />
      ) : null}

      <div className="space-y-2.5" data-guide="invoices-filters">
        {typeFilter === 'advances' && advancesError ? (
          <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
            {t('advances.unread', 'پیش‌پرداخت‌ها خوانده نشدند')}
          </p>
        ) : null}

        <DataTable
          paginate={false}
          tableId="invoices"
          t={t}
          rows={rows}
          columns={columns}
          cardOrder={['total', 'type', 'createdAt', 'paymentDate']}
          cardTone={(row) => {
            const status = row.rowType === 'invoice' ? row.invoice.status : row.advance.status
            const v = statusVariant(status)
            return v === 'secondary' ? undefined : v
          }}
          rowKey={(row) => row.id}
          onRowClick={(row) => {
            if (row.rowType === 'invoice') {
              onNavigateInvoice(row.invoice.id)
            } else if (row.advance.appliedInvoiceId) {
              onNavigateInvoice(row.advance.appliedInvoiceId)
            }
          }}
          searchValue={searchValue}
          onSearchChange={onSearchChange}
          // Unified single action bar: FilterMenu + Recurring + Export CSV aligned beside Search & Columns
          actions={
            onStatusValueChange ? (
              <>
                <TableFilterMenu
                  label={t('common.filter')}
                  clearLabel={t('common.clearFilters')}
                  groups={[
                    {
                      id: 'status',
                      label: t('invoices.status'),
                      value: statusValue,
                      onChange: onStatusValueChange,
                      options: [{ value: 'all', label: t('invoices.filterAll') }, ...statusOptions],
                    },
                    ...(typeFilter !== 'advances' && onBranchFilterChange && branches.length > 0
                      ? [
                          {
                            id: 'branch',
                            label: t('invoices.branch'),
                            value: branchFilter,
                            onChange: onBranchFilterChange,
                            options: [
                              { value: 'all', label: t('invoices.allBranches') },
                              ...branches.map((branch) => ({
                                value: branch.id,
                                label: branch.name,
                              })),
                            ],
                          },
                        ]
                      : []),
                    ...(typeFilter !== 'advances' &&
                    onWarehouseFilterChange &&
                    warehouses.length > 0
                      ? [
                          {
                            id: 'warehouse',
                            label: t('invoices.warehouse'),
                            value: warehouseFilter,
                            onChange: onWarehouseFilterChange,
                            options: [
                              { value: 'all', label: t('invoices.allWarehouses') },
                              ...warehouses.map((warehouse) => ({
                                value: warehouse.id,
                                label: warehouse.name,
                              })),
                            ],
                          },
                        ]
                      : []),
                  ]}
                />
                {toolbarExtra}
                {typeFilter !== 'advances' ? <ExportButton t={t} invoices={statsInvoices} /> : null}
              </>
            ) : undefined
          }
          minWidthClass="min-w-[420px] sm:min-w-[720px]"
          selectedIds={typeFilter === 'trading' ? selection.selectedIds : undefined}
          onToggleRow={typeFilter === 'trading' ? selection.toggleRow : undefined}
          onToggleAll={typeFilter === 'trading' ? selection.toggleAll : undefined}
          bulkBar={
            typeFilter === 'trading' ? (
              <BulkActionBar
                t={t}
                selectedCount={selection.selectedCount}
                busy={bulkDelete.busy}
                result={bulkDelete.result}
                onClear={selection.clear}
                actions={[
                  {
                    id: 'delete',
                    label: t('common.delete', 'حذف'),
                    icon: <Trash2 className="size-3.5" aria-hidden="true" />,
                    destructive: true,
                    confirmLabel: t('invoices.bulkDeleteConfirm', 'فاکتورهای انتخاب‌شده حذف شوند؟'),
                    onRun: handleBulkDelete,
                  },
                ]}
              />
            ) : undefined
          }
          emptyState={
            <EmptyState
              icon="invoice"
              title={
                typeFilter === 'advances'
                  ? t('invoices.noAdvances', 'هیچ پیش‌خرید یا پیش‌فروشی یافت نشد')
                  : t('invoices.noInvoices', 'هیچ فاکتوری یافت نشد')
              }
              description={
                typeFilter === 'advances'
                  ? t(
                      'invoices.noAdvancesDesc',
                      'پیش‌خرید و پیش‌فروش از همین صفحه با «صورت‌حساب جدید» ثبت می‌شود.',
                    )
                  : t('invoices.noInvoicesDesc', 'هنوز هیچ فاکتوری ثبت نشده است.')
              }
              action={{
                label: t('invoices.newinvoices', 'فاکتور جدید'),
                onClick: onNewInvoice,
              }}
            />
          }
        />

        {typeFilter !== 'advances' && total > filters.limit ? (
          <PaginationControls
            t={t}
            page={filters.page}
            totalPages={totalPages}
            onPageChange={onPageChange}
          />
        ) : null}

        {typeFilter === 'advances' && advancesLoading ? (
          <p className="text-sm text-[hsl(var(--fg-secondary))]">
            {t('advances.loading', 'در حال خواندن…')}
          </p>
        ) : null}
      </div>
    </div>
  )
})

/** The invoice half of the shared row model. */
function toInvoiceListRow(invoice: Invoice): InvoiceListRow {
  return {
    rowType: 'invoice',
    id: invoice.id,
    kind: invoice.type === 'purchase' ? 'purchase' : 'sale',
    invoice,
  }
}

InvoicesView.displayName = 'InvoicesView'
