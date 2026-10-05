'use client'

import { SegmentedControl } from '../segmented-control'
import { INVOICE_STATUS_FILTERS } from '../../../lib/invoices/invoices-format'
import { memo, useCallback, useEffect, useMemo, type ReactNode } from 'react'
import { cn } from '../../../lib/utils'
import { FOCUS_RING } from '../focus-ring'
import { EmptyState } from '../empty-state'
import { InvoicesSkeleton } from './invoices-skeleton'
import { Plus, FileText, DollarSign, CheckCircle2, Clock, Download, Trash2 } from 'lucide-react'
import { exportToCSV } from '../../../lib/export'
import { csvFilename } from '@hisabche/formatting'
import {
  INVOICE_EXPORT_COLUMNS,
  invoiceTypeLabelKey,
  resolveExportColumns,
} from '@hisabche/ui-contract'
import { InvoiceRowActions } from './invoice-row-actions'
import { BentoStats, type BentoStat } from '../bento-stats'
import type { InvoiceListSummary } from '@hisabche/api'
import {
  BulkActionBar,
  DataTable,
  TableFilterSelect,
  useBulkAction,
  useRowSelection,
  type TableColumn,
} from '../data-table'
import type { Invoice } from '../../../lib/invoices/invoices-types'
import { partyLabel } from '../../../lib/anonymous-party'

/* ═══════════════════════════════════════════════════════════════════════════
   InvoicesView v3 — shared DataTable · collapsible search · column settings
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
  /** Rendered beside the export button (the recurring-invoices entry). */
  toolbarExtra?: ReactNode
  /**
   * Returns a promise so bulk delete can await each call and report which
   * invoices actually went. A `void` signature would make every item look
   * successful the instant it was dispatched.
   */
  onDeleteInvoice: (id: string) => void | Promise<void>
  statusVariant: (status: string) => 'success' | 'warning' | 'destructive' | 'secondary'
  /** Filters on the canonical `invoice.type`, never on display text. */
  typeFilter?: InvoiceTypeFilter | undefined
  onTypeFilterChange?: ((value: InvoiceTypeFilter) => void) | undefined
  /** `'all'`, or one of `INVOICE_STATUS_FILTERS`. Applies inside whichever type is open. */
  statusFilter?: string | undefined
  onStatusFilterChange?: ((value: string) => void) | undefined
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

/** درصد تغییر؛ null یعنی داده‌ای برای مقایسه نیست */
function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? null : 100
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
    <SegmentedControl
      label={t('invoices.type', 'نوع')}
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
          FOCUS_RING,
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
    FOCUS_RING,
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
  onDeleteInvoice: InvoicesViewProps['onDeleteInvoice'],
  onNavigateParty: InvoicesViewProps['onNavigateParty'],
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
        // The list mixes sales and purchases, so one column header cannot say
        // "خریدار" — on a purchase row that party is the seller. The neutral
        // «طرف حساب» is correct for both; the per-row direction is already
        // carried by the type column beside it.
        labelKey: 'invoices.party',
        labelFallback: 'طرف حساب',
        sortValue: (inv) => inv.customerName ?? '',
        // H2 — the party's name reaches the party.
        //
        // A link ONLY when there is an id to go to. A walk-in cash sale has a
        // name and no customer record; rendering it as a link would send the
        // user to a page that does not exist, which is worse than plain text.
        render: (inv) =>
          inv.customerId && inv.customerName ? (
            <button
              type="button"
              // The row itself opens the invoice. Without this the click
              // bubbles and the user lands on the invoice they were trying to
              // navigate AWAY from.
              onClick={(event) => {
                event.stopPropagation()
                onNavigateParty?.(inv.customerId!)
              }}
              className="text-start text-[hsl(var(--color-primary))] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))] rounded"
            >
              {inv.customerName}
            </button>
          ) : (
            // ⚠️ One fact, one wording. A walk-in sale has no customer and
            // the product said so four different ways — see `anonymous-party.ts`.
            <span className="text-[hsl(var(--fg-primary))]">
              {partyLabel(inv.customerId, inv.customerName, t)}
            </span>
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
    [
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
  toolbarExtra,
  onDeleteInvoice,
  statusVariant,
  typeFilter = 'all',
  onTypeFilterChange,
  statusFilter = 'all',
  onStatusFilterChange,
  branches = [],
  branchFilter = 'all',
  onBranchFilterChange,
  warehouses = [],
  warehouseFilter = 'all',
  onWarehouseFilterChange,
}: InvoicesViewProps) {
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

  // ─── Bulk delete ───
  // There is no bulk endpoint; this reuses the same per-invoice delete the row
  // menu calls, so authorization and side effects (stock, ledger) are identical.
  const selection = useRowSelection()
  const bulkDelete = useBulkAction(
    useCallback(async (id: string) => onDeleteInvoice(id), [onDeleteInvoice]),
  )

  const invoiceIds = useMemo(() => invoices.map((inv) => inv.id), [invoices])

  // Rows that vanished (deleted, filtered out, paged away) must not stay
  // selected — a later action would target ids that are no longer listed.
  useEffect(() => {
    selection.prune(invoiceIds)
  }, [invoiceIds, selection])

  const handleBulkDelete = useCallback(async () => {
    await bulkDelete.run([...selection.selectedIds])
    selection.clear()
  }, [bulkDelete, selection])

  if (isLoading) {
    return <InvoicesSkeleton />
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <InvoicesHeader t={t} onNewInvoice={onNewInvoice} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Drawn under the hub's tabs (`branch`), not in this row. */}
        <TypeFilter t={t} value={typeFilter} onChange={onTypeFilterChange} />
        <div className="ms-auto flex flex-wrap items-center gap-2">
          {toolbarExtra}
          <ExportButton t={t} invoices={statsInvoices} />
        </div>
      </div>

      {statsSummary && statsSummary.count > 0 && <BentoStats t={t} stats={stats} />}

      <DataTable
        tableId="invoices"
        t={t}
        rows={invoices}
        columns={columns}
        rowKey={(inv) => inv.id}
        onRowClick={(inv) => onNavigateInvoice(inv.id)}
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        // The status filter sits in the table's own toolbar, beside search, saved
        // views and column settings: it changes what this table holds.
        actions={
          onStatusFilterChange ? (
            <>
              <TableFilterSelect
                label={t('invoices.status', 'وضعیت')}
                value={statusFilter}
                onChange={onStatusFilterChange}
                options={[
                  { value: 'all', label: t('invoices.filterAll', 'همه') },
                  ...INVOICE_STATUS_FILTERS.map((status) => ({
                    value: status,
                    label: t(`invoices.${status}`, status),
                  })),
                ]}
              />
              {/* By branch and by warehouse — offered only when there is one to choose. */}
              {onBranchFilterChange && branches.length > 0 ? (
                <TableFilterSelect
                  label={t('invoices.branch', 'شعبه')}
                  value={branchFilter}
                  onChange={onBranchFilterChange}
                  options={[
                    { value: 'all', label: t('invoices.allBranches', 'همه‌ی شعبه‌ها') },
                    ...branches.map((branch) => ({ value: branch.id, label: branch.name })),
                  ]}
                />
              ) : null}
              {onWarehouseFilterChange && warehouses.length > 0 ? (
                <TableFilterSelect
                  label={t('invoices.warehouse', 'انبار')}
                  value={warehouseFilter}
                  onChange={onWarehouseFilterChange}
                  options={[
                    { value: 'all', label: t('invoices.allWarehouses', 'همه‌ی انبارها') },
                    ...warehouses.map((warehouse) => ({
                      value: warehouse.id,
                      label: warehouse.name,
                    })),
                  ]}
                />
              ) : null}
            </>
          ) : undefined
        }
        minWidthClass="min-w-[420px] sm:min-w-[720px]"
        selectedIds={selection.selectedIds}
        onToggleRow={selection.toggleRow}
        onToggleAll={selection.toggleAll}
        bulkBar={
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
        }
        emptyState={
          <EmptyState
            icon="invoice"
            title={t('invoices.noInvoices', 'هیچ فاکتوری یافت نشد')}
            description={t('invoices.noInvoicesDesc', 'هنوز هیچ فاکتوری ثبت نشده است.')}
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
