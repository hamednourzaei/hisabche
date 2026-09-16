// ============================================
// STEP 1 of 2 — the invoice builder.
//
// Everything needed to create an invoice is on this one page: the customer,
// the dates, the spreadsheet, the summary. There is no wizard. The only
// forward move is «پیش‌نمایش و تأیید», which is STEP 2 and a separate route.
// ============================================
'use client'

import { memo, useCallback, useMemo, useState, type ReactNode } from 'react'
import { ChevronLeft, FileText, Save } from 'lucide-react'
import {
  canDeleteColumn,
  isForeignMoneyColumn,
  type GridMoneyContext,
  type InvoiceColumn,
  type InvoiceGridRow,
  type InvoiceSummary,
} from '@hisabche/validation'
import type { CurrencyCode, InvoiceDraftCustomer } from '@hisabche/store'

import { Button } from '../button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../dialog'
import { ColumnDialog } from './column-dialog'
import { CustomerPanel } from './customer-panel'
import { InvoiceSummaryPanel } from './invoice-summary-panel'
import { TableSettingsDialog } from './table-settings-dialog'
import { GridToolbar } from './grid/grid-toolbar'
import { InvoiceItemsGrid } from './grid/invoice-items-grid'
import { ColumnsSheet } from './mobile/columns-sheet'
import { InvoiceBuilderMobile } from './mobile/invoice-builder-mobile'
import { ItemEditorSheet } from './mobile/item-editor-sheet'

export interface InvoiceBuilderPageProps {
  t: (key: string, fallback?: string) => string
  locale: string

  columns: InvoiceColumn[]
  rows: InvoiceGridRow[]
  ctx: GridMoneyContext
  summary: InvoiceSummary
  invalidRowIds: ReadonlySet<string>
  /** Blocking problems, already translated. */
  issues: string[]
  /** Non-blocking "stock goes below zero" notice, shown while typing. */
  stockWarning?: ReactNode

  customers: readonly InvoiceDraftCustomer[]
  transactionType: 'sale' | 'purchase'
  currency: CurrencyCode
  rates: Partial<Record<CurrencyCode, string>>
  date: string
  dueDate: string | null
  notes: string
  discountValue: string
  discountType: 'fixed' | 'percentage'
  taxRate: string

  onCellChange: (rowId: string, columnId: string, value: string) => void
  onAddRow: () => void
  onRemoveRow: (rowId: string) => void
  onDuplicateRow: (rowId: string) => void
  onRemoveLastRow: () => void
  onPickProduct: (
    rowId: string,
    product: { id: string; name: string; price: string; unit: string },
  ) => void
  onAddColumn: (column: InvoiceColumn) => void
  onUpdateColumn: (id: string, patch: Partial<InvoiceColumn>) => void
  onReplaceColumn: (column: InvoiceColumn) => void
  onRemoveColumn: (id: string) => void
  onMoveColumn: (id: string, direction: -1 | 1) => void
  onResetColumns: () => void

  onAddCustomer: (customer: InvoiceDraftCustomer) => void
  onRemoveCustomer: (id: string) => void
  onTransactionTypeChange: (type: 'sale' | 'purchase') => void
  onCurrencyChange: (currency: CurrencyCode) => void
  onRateChange: (currency: CurrencyCode, value: string) => void
  onDateChange: (value: string) => void
  onDueDateChange: (value: string | null) => void
  onNotesChange: (value: string) => void
  onDiscountValueChange: (value: string) => void
  onDiscountTypeChange: (type: 'fixed' | 'percentage') => void
  onTaxRateChange: (value: string) => void

  onSaveDraft: () => void
  onContinue: () => void
  onBackToList: () => void
  savingDraft: boolean
}

export const InvoiceBuilderPage = memo(function InvoiceBuilderPage({
  t,
  locale,
  columns,
  rows,
  ctx,
  summary,
  invalidRowIds,
  issues,
  stockWarning,
  customers,
  transactionType,
  currency,
  rates,
  date,
  dueDate,
  notes,
  discountValue,
  discountType,
  taxRate,
  onCellChange,
  onAddRow,
  onRemoveRow,
  onDuplicateRow,
  onRemoveLastRow,
  onPickProduct,
  onAddColumn,
  onUpdateColumn,
  onReplaceColumn,
  onRemoveColumn,
  onMoveColumn,
  onResetColumns,
  onAddCustomer,
  onRemoveCustomer,
  onTransactionTypeChange,
  onCurrencyChange,
  onRateChange,
  onDateChange,
  onDueDateChange,
  onNotesChange,
  onDiscountValueChange,
  onDiscountTypeChange,
  onTaxRateChange,
  onSaveDraft,
  onContinue,
  onBackToList,
  savingDraft,
}: InvoiceBuilderPageProps) {
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null)
  const [columnDialogOpen, setColumnDialogOpen] = useState(false)
  const [editingColumn, setEditingColumn] = useState<InvoiceColumn | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<InvoiceColumn | null>(null)
  // Mobile-only surfaces. Rendered at every width but only reachable below
  // `md`, so the two presentations never fight over one piece of state.
  const [columnsSheetOpen, setColumnsSheetOpen] = useState(false)
  const [editingRowId, setEditingRowId] = useState<string | null>(null)

  const editingRow = useMemo(
    () => rows.find((r) => r.id === editingRowId) ?? null,
    [rows, editingRowId],
  )

  const selectedColumn = useMemo(
    () => columns.find((c) => c.id === selectedColumnId) ?? null,
    [columns, selectedColumnId],
  )

  const foreignCurrencies = useMemo(() => {
    const set = new Set<CurrencyCode>()
    for (const column of columns) {
      if (isForeignMoneyColumn(column, ctx) && column.currency) set.add(column.currency)
    }
    return [...set]
  }, [columns, ctx])

  const openAddColumn = useCallback(() => {
    setEditingColumn(null)
    setColumnDialogOpen(true)
  }, [])

  const openEditColumn = useCallback((column: InvoiceColumn) => {
    setEditingColumn(column)
    setColumnDialogOpen(true)
  }, [])

  const requestDeleteColumn = useCallback((column: InvoiceColumn | null) => {
    if (!column || !canDeleteColumn(column)) return
    setPendingDelete(column)
  }, [])

  const confirmDelete = useCallback(() => {
    if (!pendingDelete) return
    onRemoveColumn(pendingDelete.id)
    if (selectedColumnId === pendingDelete.id) setSelectedColumnId(null)
    setPendingDelete(null)
  }, [pendingDelete, onRemoveColumn, selectedColumnId])

  const submitColumn = useCallback(
    (column: InvoiceColumn) => {
      if (editingColumn) onReplaceColumn(column)
      else onAddColumn(column)
    },
    [editingColumn, onAddColumn, onReplaceColumn],
  )

  const blocked = issues.length > 0

  return (
    // `min-w-0` on the page wrapper and on every flex/grid child is what stops
    // the wide grid from stretching the page. The scroller is inside the card.
    <div className="mx-auto w-full min-w-0 max-w-[100rem] pb-6">
      {/* ── Below `md`: the card-based workflow. A phone is not a narrow
          desktop, so it gets a different interaction model rather than the
          same table at a smaller size. Both read one draft store. ── */}
      <div className="md:hidden">
        <InvoiceBuilderMobile
          t={t}
          locale={locale}
          columns={columns}
          rows={rows}
          ctx={ctx}
          summary={summary}
          invalidRowIds={invalidRowIds}
          issues={issues}
          stockWarning={stockWarning}
          customers={customers}
          transactionType={transactionType}
          currency={currency}
          rates={rates}
          date={date}
          dueDate={dueDate}
          notes={notes}
          discountValue={discountValue}
          discountType={discountType}
          taxRate={taxRate}
          onAddCustomer={onAddCustomer}
          onRemoveCustomer={onRemoveCustomer}
          onTransactionTypeChange={onTransactionTypeChange}
          onCurrencyChange={onCurrencyChange}
          onRateChange={onRateChange}
          onDateChange={onDateChange}
          onDueDateChange={onDueDateChange}
          onNotesChange={onNotesChange}
          onDiscountValueChange={onDiscountValueChange}
          onDiscountTypeChange={onDiscountTypeChange}
          onTaxRateChange={onTaxRateChange}
          onAddRow={onAddRow}
          onEditRow={setEditingRowId}
          onDuplicateRow={onDuplicateRow}
          onRemoveRow={onRemoveRow}
          onOpenColumns={() => setColumnsSheetOpen(true)}
          onBack={onBackToList}
          onContinue={onContinue}
          savingDraft={savingDraft}
        />

        <ItemEditorSheet
          open={editingRow !== null}
          onOpenChange={(open) => !open && setEditingRowId(null)}
          t={t}
          locale={locale}
          row={editingRow}
          columns={columns}
          ctx={ctx}
          onCellChange={onCellChange}
          onPickProduct={onPickProduct}
        />

        <ColumnsSheet
          open={columnsSheetOpen}
          onOpenChange={setColumnsSheetOpen}
          t={t}
          columns={columns}
          onToggleVisible={(id, visible) => onUpdateColumn(id, { visible })}
          onToggleAggregate={(id, aggregate) => onUpdateColumn(id, { aggregate })}
          onToggleIncludeInTotal={(id, includeInTotal) => onUpdateColumn(id, { includeInTotal })}
          onMove={onMoveColumn}
          onEdit={openEditColumn}
          onDelete={requestDeleteColumn}
          onAdd={openAddColumn}
        />
      </div>

      {/* ── `md` and up: the spreadsheet, unchanged. ── */}
      <div className="hidden space-y-4 md:block">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <nav aria-label={t('invoiceBuilder.breadcrumb', 'مسیر')} className="mb-1">
              <ol className="flex items-center gap-1.5 text-xs text-[hsl(var(--fg-tertiary))]">
                <li>
                  <button
                    type="button"
                    onClick={onBackToList}
                    className="hover:text-[hsl(var(--fg-primary))]"
                  >
                    {t('nav.invoices', 'فاکتورها')}
                  </button>
                </li>
                {/* An RTL breadcrumb points the way the text runs. */}
                <ChevronLeft className="size-3 rtl:rotate-180" aria-hidden="true" />
                <li className="text-[hsl(var(--fg-secondary))]">
                  {t('invoiceBuilder.new', 'فاکتور جدید')}
                </li>
              </ol>
            </nav>
            <h1 className="flex items-center gap-2 text-xl font-bold text-[hsl(var(--fg-primary))]">
              <FileText className="size-5 text-[hsl(var(--color-primary))]" aria-hidden="true" />
              {t('invoiceBuilder.new', 'فاکتور جدید')}
            </h1>
          </div>

          {/* Always visible. These were `hidden lg:flex`, which took the two
            primary actions away on every tablet and small laptop and left the
            page with no way forward until it was widened. They shrink instead:
            below `sm` the draft button becomes its icon and the CTA takes the
            short label. */}
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              onClick={onSaveDraft}
              loading={savingDraft}
              className="gap-1.5 px-3 sm:px-4"
              aria-label={t('invoiceBuilder.saveDraft', 'ذخیره پیش‌نویس')}
            >
              <Save className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">
                {t('invoiceBuilder.saveDraft', 'ذخیره پیش‌نویس')}
              </span>
            </Button>
            <Button
              variant="success"
              onClick={onContinue}
              disabled={blocked}
              className="gap-1.5 px-3 sm:px-5"
            >
              <span className="hidden lg:inline">
                {t('invoiceBuilder.continue', 'مرحله بعدی: پیش‌نمایش و تأیید')}
              </span>
              <span className="lg:hidden">
                {t('invoiceBuilder.continueShort', 'پیش‌نمایش و تأیید')}
              </span>
              {/* Last in the DOM, so in RTL it lands on the LEFT edge — where
                the reader's eye exits and where "forward" lives. It points
                left for the same reason, so it is NOT mirrored. */}
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        <p className="text-xs text-[hsl(var(--fg-tertiary))]">
          {t('invoiceBuilder.stepOne', 'مرحله ۱: اطلاعات و ثبت کالا/خدمت')}
        </p>

        {/* ── Grid + customer panel ──────────────────────────────────────── */}
        <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[1fr_20rem]">
          <div className="min-w-0 rounded-[var(--radius-lg)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]">
            <GridToolbar
              t={t}
              selectedColumnLabel={
                selectedColumn
                  ? selectedColumn.labelKey
                    ? t(selectedColumn.labelKey, selectedColumn.label)
                    : selectedColumn.label
                  : null
              }
              canDeleteSelected={!!selectedColumn && canDeleteColumn(selectedColumn)}
              onAddRow={onAddRow}
              onAddColumn={openAddColumn}
              onDeleteColumn={() => requestDeleteColumn(selectedColumn)}
              onOpenSettings={() => setSettingsOpen(true)}
              onResetColumns={onResetColumns}
            />

            <InvoiceItemsGrid
              t={t}
              locale={locale}
              columns={columns}
              rows={rows}
              ctx={ctx}
              selectedColumnId={selectedColumnId}
              onSelectColumn={setSelectedColumnId}
              onCellChange={onCellChange}
              onPickProduct={onPickProduct}
              onMoveColumn={onMoveColumn}
              onRemoveRow={onRemoveRow}
              onDuplicateRow={onDuplicateRow}
              invalidRowIds={invalidRowIds}
            />
          </div>

          <div className="min-w-0 space-y-4">
            <CustomerPanel
              t={t}
              customers={customers}
              onAddCustomer={onAddCustomer}
              onRemoveCustomer={onRemoveCustomer}
              transactionType={transactionType}
              onTransactionTypeChange={onTransactionTypeChange}
              currency={currency}
              onCurrencyChange={onCurrencyChange}
              foreignCurrencies={foreignCurrencies}
              rates={rates}
              onRateChange={onRateChange}
              date={date}
              onDateChange={onDateChange}
              dueDate={dueDate}
              onDueDateChange={onDueDateChange}
              notes={notes}
              onNotesChange={onNotesChange}
            />

            <InvoiceSummaryPanel
              t={t}
              locale={locale}
              currency={currency}
              precision={ctx.precision}
              summary={summary}
              discountValue={discountValue}
              discountType={discountType}
              onDiscountValueChange={onDiscountValueChange}
              onDiscountTypeChange={onDiscountTypeChange}
              taxRate={taxRate}
              onTaxRateChange={onTaxRateChange}
            />

            {stockWarning}

            {issues.length ? (
              <ul
                role="alert"
                className="space-y-1 rounded-[var(--radius-md)] border border-[hsl(var(--color-destructive)/0.4)] bg-[hsl(var(--color-destructive)/0.06)] p-3 text-xs text-[hsl(var(--color-destructive))]"
              >
                {issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── Dialogs — shared by both presentations ─────────────────────── */}
      <ColumnDialog
        open={columnDialogOpen}
        onOpenChange={setColumnDialogOpen}
        t={t}
        column={editingColumn}
        existingColumns={columns}
        invoiceCurrency={currency}
        onSubmit={submitColumn}
      />

      <TableSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        t={t}
        columns={columns}
        onToggleVisible={(id, visible) => onUpdateColumn(id, { visible })}
        onToggleAggregate={(id, aggregate) => onUpdateColumn(id, { aggregate })}
        onToggleIncludeInTotal={(id, includeInTotal) => onUpdateColumn(id, { includeInTotal })}
        onMove={onMoveColumn}
        onEdit={openEditColumn}
        onDelete={requestDeleteColumn}
        onReset={onResetColumns}
      />

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('invoiceBuilder.toolbar.deleteColumn', 'حذف ستون')}</DialogTitle>
            <DialogDescription>
              {t('invoiceBuilder.column.deleteConfirm', 'آیا از حذف این ستون مطمئن هستید؟')}
              {pendingDelete ? ` «${pendingDelete.label}»` : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              {t('common.cancel', 'انصراف')}
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              {t('common.delete', 'حذف')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
})

InvoiceBuilderPage.displayName = 'InvoiceBuilderPage'
