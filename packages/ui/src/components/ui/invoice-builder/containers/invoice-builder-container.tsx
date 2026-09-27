// ============================================
// STEP 1 container. Owns navigation intent and the draft store; every number
// it shows comes from `useInvoiceDraft`.
// ============================================
'use client'

import { memo, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { COLUMN, currencyPrecision, moveColumn, type InvoiceColumn } from '@hisabche/validation'
import { formatNumber } from '@hisabche/formatting'
import {
  useCurrencyStore,
  useInvoiceDraftStore,
  useSyncStore,
  type CurrencyCode,
} from '@hisabche/store'

import { useInvoiceDraft } from '../../../../hooks/invoices/use-invoice-draft'
import { InvoiceBuilderPage } from '../invoice-builder-page'
import { OversoldWarning } from '../oversold-warning'
import { useOversoldLines } from '../use-oversold-lines'
import { CreditLimitWarning } from '../credit-limit-warning'
import { useCustomerTerms } from '../use-customer-terms'
import { InvoiceWarehouseSelect } from '../invoice-warehouse-select'
import { BarcodeScanDialog, type ScanProblem } from '../barcode-scan-dialog'
import { CameraScanButton } from '../camera-scan-button'
import {
  loadScaleLabelConfig,
  parseScaleLabel,
  quantityOfLabel,
  type ScaleLabel,
} from '../../../../lib/barcode/scale-label'
import { useBarcodeScanner } from '../../../../hooks/use-barcode-scanner'
import { planScan } from '../../../../lib/barcode/scan-into-invoice'
import { lookupProductByBarcode } from '@hisabche/api'
import type { Product } from '@hisabche/validation'

export const InvoiceBuilderContainer = memo(function InvoiceBuilderContainer() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setSaveStatus } = useSyncStore()
  const { t, locale, currency, ctx, summary, invalidRowIds, issues, items } = useInvoiceDraft()

  const draft = useInvoiceDraftStore()
  const setPrimaryCurrency = useCurrencyStore((s) => s.setPrimaryCurrency)
  const [savingDraft, setSavingDraft] = useState(false)

  // `?type=purchase` is how /purchasing and the command palette open this
  // form in purchase mode. Applied on change rather than as initial state,
  // because picking the other action while already here only swaps the query
  // string — the component never remounts.
  const typeParam = searchParams?.get('type')
  useEffect(() => {
    if (typeParam === 'purchase' || typeParam === 'sale') {
      draft.setField('transactionType', typeParam)
    }
  }, [typeParam, draft])

  // The layout is created once, for the user's currency, and then persists.
  // Re-running it on every currency change would throw away columns the user
  // had added.
  useEffect(() => {
    draft.initColumns(currency)
  }, [draft, currency])

  // Picking a warehouse product links `productId`, which is what makes the
  // backend move stock for this line. Free text leaves it unset and moves no
  // stock — both are legitimate invoice lines.
  const handlePickProduct = useCallback(
    (rowId: string, product: { id: string; name: string; price: string; unit: string }) => {
      draft.setRowProduct(rowId, product.id, product.name, product.price)
      draft.setCell(rowId, COLUMN.unit, product.unit || 'piece')
    },
    [draft],
  )

  // ─── Barcode scanner → invoice line ──────────────────────────────────────
  // A scan fills a DRAFT line (same product + unit again → +1). Nothing is
  // posted: stock, ledger and receivable move only when the invoice is issued.
  const [scanProblem, setScanProblem] = useState<ScanProblem | null>(null)

  const placeScanned = useCallback(
    (product: Product, add = 1) => {
      // No id → nothing to link stock to; never a line that moves nothing.
      if (!product.id) return
      const unit = product.unit || 'piece'
      const price = String(
        (draft.transactionType === 'purchase' ? product.buyPrice : product.sellPrice) ?? '',
      )
      // Read the store at the moment of the scan: two scans a few ms apart
      // must see each other's line, not the same render's snapshot.
      const rows = useInvoiceDraftStore.getState().rows
      const plan = planScan(rows, { id: product.id, name: product.name, price, unit }, add)
      if (plan.kind === 'increment') {
        draft.setCell(plan.rowId, COLUMN.quantity, plan.quantity)
        return
      }
      let rowId = plan.kind === 'fill' ? plan.rowId : null
      if (!rowId) {
        draft.addRow()
        rowId = useInvoiceDraftStore.getState().rows.at(-1)?.id ?? null
      }
      if (!rowId) return
      draft.setRowProduct(rowId, product.id, product.name, price)
      draft.setCell(rowId, COLUMN.unit, unit)
      if (add !== 1) draft.setCell(rowId, COLUMN.quantity, String(add))
    },
    [draft],
  )

  // A scale label's weight (or price ÷ unit price) is the quantity; an
  // ordinary code adds one. null = a price label the product cannot convert.
  const placeWithLabel = useCallback(
    (product: Product, label: ScaleLabel | undefined, barcode: string) => {
      if (!label) return placeScanned(product)
      const unitPrice = Number(
        (draft.transactionType === 'purchase' ? product.buyPrice : product.sellPrice) ?? 0,
      )
      const quantity = quantityOfLabel(label, unitPrice)
      if (quantity === null) return setScanProblem({ kind: 'noUnitPrice', barcode })
      placeScanned(product, quantity)
    },
    [draft.transactionType, placeScanned],
  )

  const handleScan = useCallback(
    async (barcode: string) => {
      // A scale label is looked up by prefix + item code, not the whole code.
      const label = parseScaleLabel(barcode, loadScaleLabelConfig()) ?? undefined
      const code = label ? label.productCode : barcode
      const result = await lookupProductByBarcode(code)
      if (result.status === 'found') {
        // An extra code that sells in its own unit (the carton's code) adds that unit.
        const product = result.unit ? { ...result.product, unit: result.unit } : result.product
        placeWithLabel(product, label, barcode)
        return
      }
      setScanProblem(
        result.status === 'ambiguous'
          ? { kind: 'ambiguous', barcode: code, products: result.products, label }
          : result.status === 'unknown'
            ? { kind: 'unknown', barcode: result.barcode }
            : { kind: 'error', barcode: result.barcode, offline: result.offline },
      )
    },
    [placeWithLabel],
  )

  // Paused while the dialog is open: the cashier is answering it.
  useBarcodeScanner((scan) => void handleScan(scan.value), { enabled: scanProblem === null })

  const handleReplaceColumn = useCallback(
    (column: InvoiceColumn) => draft.updateColumn(column.id, column),
    [draft],
  )

  const handleMoveColumn = useCallback(
    (id: string, direction: -1 | 1) => draft.setColumns(moveColumn(draft.columns, id, direction)),
    [draft],
  )

  const handleCurrencyChange = useCallback(
    (next: CurrencyCode) => {
      setPrimaryCurrency(next)
      // The invoice's own money columns follow the invoice. A column the user
      // deliberately pinned to another currency is left alone — that is the
      // whole reason they set it.
      draft.setColumns(
        draft.columns.map((column) =>
          column.type === 'currency' && column.currency === currency
            ? { ...column, currency: next, precision: currencyPrecision(next) }
            : column.type === 'computed'
              ? { ...column, currency: next, precision: currencyPrecision(next) }
              : column,
        ),
      )
    },
    [draft, currency, setPrimaryCurrency],
  )

  const handleSaveDraft = useCallback(() => {
    // The draft store is already persisted on every keystroke, so "save" is
    // an acknowledgement, not a write. Saying so beats faking a request.
    setSavingDraft(true)
    setSaveStatus('saving')
    setTimeout(() => {
      setSaveStatus('saved')
      setSavingDraft(false)
      setTimeout(() => setSaveStatus('idle'), 1500)
    }, 300)
  }, [setSaveStatus])

  // Warn while the quantity is typed, not only on the preview (see the hook).
  const oversoldLines = useOversoldLines(items, draft.transactionType)

  // Customer terms: fill an empty due date, warn past the credit limit.
  const setDueDate = useCallback((value: string) => draft.setField('dueDate', value), [draft])
  const setWarehouseId = useCallback(
    (value: string | null) => draft.setField('warehouseId', value),
    [draft],
  )
  const creditBreachInfo = useCustomerTerms({
    customerId: draft.customers[0]?.id,
    transactionType: draft.transactionType,
    date: draft.date,
    dueDate: draft.dueDate,
    invoiceTotal: summary.total,
    setDueDate,
  })

  const handleContinue = useCallback(() => router.push('/invoices/new/preview'), [router])
  const handleBackToList = useCallback(() => router.push('/invoices'), [router])

  return (
    <>
      <BarcodeScanDialog
        t={t}
        problem={scanProblem}
        onPick={(product) => {
          const picked = scanProblem
          setScanProblem(null)
          placeWithLabel(
            product,
            picked?.kind === 'ambiguous' ? picked.label : undefined,
            picked?.barcode ?? '',
          )
        }}
        onRetry={(barcode) => {
          setScanProblem(null)
          void handleScan(barcode)
        }}
        onClose={() => setScanProblem(null)}
      />
      <InvoiceBuilderPage
        t={t}
        locale={locale}
        columns={draft.columns}
        rows={draft.rows}
        ctx={ctx}
        summary={summary}
        invalidRowIds={invalidRowIds}
        issues={issues}
        stockWarning={
          <>
            <CameraScanButton
              t={t}
              onCode={(code) => void handleScan(code)}
              disabled={scanProblem !== null}
            />
            <InvoiceWarehouseSelect
              t={t}
              transactionType={draft.transactionType}
              value={draft.warehouseId}
              onChange={setWarehouseId}
            />
            <OversoldWarning t={t} lines={oversoldLines} />
            <CreditLimitWarning
              t={t}
              breach={creditBreachInfo}
              formatMoney={(value) => formatNumber(value, locale, 2)}
            />
          </>
        }
        customers={draft.customers}
        transactionType={draft.transactionType}
        currency={currency}
        rates={draft.rates}
        date={draft.date}
        dueDate={draft.dueDate}
        notes={draft.notes}
        discountValue={draft.discountValue}
        discountType={draft.discountType}
        taxRate={draft.taxRate}
        onCellChange={draft.setCell}
        onAddRow={draft.addRow}
        onRemoveRow={draft.removeRow}
        onDuplicateRow={draft.duplicateRow}
        onRemoveLastRow={draft.removeLastRow}
        onPickProduct={handlePickProduct}
        onAddColumn={draft.addColumn}
        onUpdateColumn={draft.updateColumn}
        onReplaceColumn={handleReplaceColumn}
        onRemoveColumn={draft.removeColumn}
        onMoveColumn={handleMoveColumn}
        onResetColumns={() => draft.resetColumns(currency)}
        onAddCustomer={draft.addCustomer}
        onRemoveCustomer={draft.removeCustomer}
        onTransactionTypeChange={(type) => draft.setField('transactionType', type)}
        onCurrencyChange={handleCurrencyChange}
        onRateChange={draft.setRate}
        onDateChange={(value) => draft.setField('date', value)}
        onDueDateChange={(value) => draft.setField('dueDate', value)}
        onNotesChange={(value) => draft.setField('notes', value)}
        onDiscountValueChange={(value) => draft.setField('discountValue', value)}
        onDiscountTypeChange={(type) => draft.setField('discountType', type)}
        onTaxRateChange={(value) => draft.setField('taxRate', value)}
        onSaveDraft={handleSaveDraft}
        onContinue={handleContinue}
        onBackToList={handleBackToList}
        savingDraft={savingDraft}
      />
    </>
  )
})

InvoiceBuilderContainer.displayName = 'InvoiceBuilderContainer'
