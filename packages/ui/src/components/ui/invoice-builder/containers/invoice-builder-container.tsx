// ============================================
// STEP 1 container. Owns navigation intent and the draft store; every number
// it shows comes from `useInvoiceDraft`.
// ============================================
'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import type { NewDocumentKind } from '../../invoices/new-invoice-chooser'
import { COLUMN, currencyPrecision, moveColumn, type InvoiceColumn } from '@hisabche/validation'
import { formatNumber } from '@hisabche/formatting'
import {
  invoiceDraftSnapshot,
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
import { InvoiceBranchSelect } from '../invoice-branch-select'
import { BarcodeScanDialog, type ScanProblem } from '../barcode-scan-dialog'
import { CameraScanButton } from '../camera-scan-button'
import { InvoiceExchangeRate } from '../invoice-exchange-rate'
import {
  exchangeRateOf,
  inBooksAtRate,
  needsExchangeRate,
  planRepricedLines,
  priceForInvoice,
  productDualBooksPrices,
  tradingSideOf,
} from '../../../../lib/invoices/exchange-rate'
import type { PickerProduct } from '../../../../lib/invoices/products'
import type { PickedProduct } from '../../../../hooks/invoices/use-picker-rows'
import { useBookCurrency } from '../../../../hooks/use-book-currency'
import {
  loadScaleLabelConfig,
  parseScaleLabel,
  quantityOfLabel,
  type ScaleLabel,
} from '../../../../lib/barcode/scale-label'
import { useBarcodeScanner } from '../../../../hooks/use-barcode-scanner'
import { planScan } from '../../../../lib/barcode/scan-into-invoice'
import {
  apiErrorMessage,
  asList,
  lookupProductByBarcode,
  rateOn,
  useExchangeRates,
  useProductsByIds,
  useSaveInvoiceDraft,
  type RateQuote,
} from '@hisabche/api'
import { useToast } from '../../toast-provider'
import type { Product } from '@hisabche/validation'
import { useLocalePush, useLocaleReplace } from '../../../../hooks/use-locale-push'
import { useBusinessProfile } from '../../../../hooks/use-business-profile'
import { nameOfCurrency } from '../../../../lib/currency-name'

/** A pre-sale / pre-purchase (advances-03) is written in this same builder. */
export function advanceKindOf(type: string | null | undefined): 'pre_sale' | 'pre_purchase' | null {
  return type === 'pre_sale' || type === 'pre_purchase' ? type : null
}

/**
 * /invoices/new — ONE builder for every document (owner request, 9 Nov 2026):
 * sale, purchase, pre-sale and pre-purchase. `?type=` says which; a pre-sale
 * is written with the same customer, lines, discount and tax as a sale, and
 * saved as an advance carrying those lines.
 */
export const InvoiceBuilderContainer = memo(function InvoiceBuilderContainer() {
  return <InvoiceBuilderGrid />
})

const InvoiceBuilderGrid = memo(function InvoiceBuilderGrid() {
  const push = useLocalePush()
  const replace = useLocaleReplace()
  const searchParams = useSearchParams()
  const { setSaveStatus } = useSyncStore()
  const { t, locale, currency, ctx, summary, invalidRowIds, issues, items } = useInvoiceDraft()

  const draft = useInvoiceDraftStore()
  const { profile } = useBusinessProfile()
  const bookCurrency = useBookCurrency()
  // A product's price is in the books currency; on an invoice in another one it
  // is converted at this invoice's rate, or left empty (priceForInvoice).
  const lineRate = exchangeRateOf(
    draft.exchangeRateFrom,
    draft.exchangeRateTo,
    currency,
    bookCurrency,
  )
  // «معادل دفتری»: what the books will record, at the rate typed on this
  // invoice (and locked on it at commit). No rate yet = no line, never × 1.
  const booksAmount =
    bookCurrency && needsExchangeRate(currency, bookCurrency)
      ? inBooksAtRate(summary.total, lineRate, bookCurrency, currency)
      : null
  const bookEquivalent =
    bookCurrency && booksAmount !== null
      ? `${formatNumber(booksAmount, locale, 9)} ${nameOfCurrency(t, bookCurrency, bookCurrency)}`
      : null
  const setRowAutoPrice = useInvoiceDraftStore((s) => s.setRowAutoPrice)
  const applyRepricedLines = useInvoiceDraftStore((s) => s.applyRepricedLines)
  const setPrimaryCurrency = useCurrencyStore((s) => s.setPrimaryCurrency)
  const [savingDraft, setSavingDraft] = useState(false)

  // `?type=purchase` is how /purchasing and the command palette open this
  // form in purchase mode. Applied on change rather than as initial state,
  // because picking the other action while already here only swaps the query
  // string — the component never remounts.
  //
  // ⚠️ The effect depends on the stable `setField` action, NOT on the whole
  // store object: `draft` is a new object after every write, so an effect
  // that writes and depends on `draft` re-runs forever (React #185 on
  // /invoices/new?type=sale, 9 Nov 2026). It also writes only on a change.
  const typeParam = searchParams?.get('type')
  const urlDocumentKind: NewDocumentKind =
    advanceKindOf(typeParam) ??
    (typeParam === 'sale' || typeParam === 'purchase' ? typeParam : draft.transactionType)
  const [optimisticKind, setOptimisticKind] = useState<NewDocumentKind | null>(null)
  const pendingKindRef = useRef<NewDocumentKind | null>(null)
  const setDraftField = useInvoiceDraftStore((s) => s.setField)
  useEffect(() => {
    if (pendingKindRef.current) {
      if (typeParam === pendingKindRef.current) {
        pendingKindRef.current = null
        setOptimisticKind(null)
      }
      return
    }
    setOptimisticKind(null)
    const wanted = tradingSideOf(typeParam)
    if (wanted && useInvoiceDraftStore.getState().transactionType !== wanted) {
      setDraftField('transactionType', wanted)
    }
  }, [typeParam, setDraftField])
  const documentKind: NewDocumentKind = optimisticKind ?? urlDocumentKind
  const activeAdvanceKind = advanceKindOf(documentKind)
  const activeSide = tradingSideOf(documentKind) ?? draft.transactionType
  const handleDocumentKindChange = useCallback(
    (kind: NewDocumentKind) => {
      pendingKindRef.current = typeParam === kind ? null : kind
      setOptimisticKind(typeParam === kind ? null : kind)
      const side = tradingSideOf(kind)
      if (side && useInvoiceDraftStore.getState().transactionType !== side) {
        setDraftField('transactionType', side)
      }
      replace(`/invoices/new?type=${kind}`)
    },
    [replace, setDraftField, typeParam],
  )

  // Backfill dual-side prices for linked rows loaded from an older draft or server
  // copy that pre-dates `autoPriced`, without touching hand-edited prices.
  const checkedLegacyRef = useRef<Set<string>>(new Set())
  const missingAutoIds = useMemo(() => {
    const out: string[] = []
    for (const row of draft.rows) {
      if (!row.productId || draft.autoPriced[row.id]) continue
      if (checkedLegacyRef.current.has(`${row.id}:${row.productId}`)) continue
      out.push(row.productId)
    }
    return [...new Set(out)]
  }, [draft.rows, draft.autoPriced])
  const legacyProducts = useProductsByIds(missingAutoIds)
  useEffect(() => {
    if (missingAutoIds.length === 0) return
    const loadedById = new Map<string, PickerProduct>()
    legacyProducts.forEach((result, index) => {
      const id = missingAutoIds[index]
      if (id && result.data) loadedById.set(id, result.data as PickerProduct)
    })
    if (loadedById.size === 0) return
    for (const row of useInvoiceDraftStore.getState().rows) {
      if (!row.productId || draft.autoPriced[row.id]) continue
      const loaded = loadedById.get(row.productId)
      if (!loaded) continue
      checkedLegacyRef.current.add(`${row.id}:${row.productId}`)
      const dual = productDualBooksPrices(loaded)
      const sellShown = priceForInvoice(dual.sellBooksPrice, currency, bookCurrency, lineRate)
      const buyShown = priceForInvoice(dual.buyBooksPrice, currency, bookCurrency, lineRate)
      const currentPrice = (row.values[COLUMN.unitPrice] ?? '').trim()
      if (
        currentPrice === '' ||
        currentPrice === sellShown.trim() ||
        currentPrice === buyShown.trim()
      ) {
        setRowAutoPrice(row.id, {
          booksPrice: currentPrice === buyShown.trim() ? dual.buyBooksPrice : dual.sellBooksPrice,
          sellBooksPrice: dual.sellBooksPrice,
          buyBooksPrice: dual.buyBooksPrice,
          filled: currentPrice,
        })
      }
    }
  }, [
    missingAutoIds,
    legacyProducts,
    draft.autoPriced,
    currency,
    bookCurrency,
    lineRate,
    setRowAutoPrice,
  ])

  // Single real-time pricing engine for sale, purchase, pre_sale, and pre_purchase:
  // switching document kind, invoice currency, or exchange rate updates every
  // app-priced line immediately while leaving hand-typed prices untouched.
  useEffect(() => {
    if (Object.keys(draft.autoPriced).length === 0) return
    const rows = useInvoiceDraftStore.getState().rows
    const updates = planRepricedLines(
      rows,
      draft.autoPriced,
      currency,
      bookCurrency,
      lineRate,
      documentKind,
    )
    if (updates.length > 0) applyRepricedLines(updates)
  }, [draft.autoPriced, documentKind, currency, bookCurrency, lineRate, applyRepricedLines])

  // The layout is created once, for the user's currency, and then persists.
  // Re-running it on every currency change would throw away columns the user
  // had added.
  useEffect(() => {
    draft.initColumns(currency, profile.invoiceDefaults)
  }, [draft, currency, profile.invoiceDefaults])

  // Picking a warehouse product links `productId`, which is what makes the
  // backend move stock for this line. Free text leaves it unset and moves no
  // stock — both are legitimate invoice lines.
  const handlePickProduct = useCallback(
    (rowId: string, product: PickedProduct) => {
      const state = useInvoiceDraftStore.getState()
      const before = state.rows.find((row) => row.id === rowId)
      const price = priceForInvoice(product.price, currency, bookCurrency, lineRate)
      // ⚠️ Picking ANOTHER product on a line whose price the app had filled
      // replaces that price (QA-006). It used to stay: product B was sold at
      // product A's price. A price the person typed is still never touched.
      const typedPrice = before?.values[COLUMN.unitPrice]?.trim() ?? ''
      const prevAuto = state.autoPriced[rowId]
      const ours = typedPrice !== '' && prevAuto?.filled.trim() === typedPrice
      if (ours && before?.productId !== product.id) draft.setCell(rowId, COLUMN.unitPrice, '')
      draft.setRowProduct(rowId, product.id, product.name, price, product.unit || 'piece')
      draft.setRowGoldSnapshot(rowId, product.goldSnapshot)
      // setRowProduct seeds the unit and price only where they are empty — only
      // then are they ours.
      if (!typedPrice || ours) {
        const sellBooksPrice = product.sellPrice ?? (activeSide === 'sale' ? product.price : '')
        const buyBooksPrice = product.buyPrice ?? (activeSide === 'purchase' ? product.price : '')
        setRowAutoPrice(rowId, {
          booksPrice: product.price,
          sellBooksPrice,
          buyBooksPrice,
          filled: price,
          ...(product.goldSnapshot ? { saleGoldSnapshot: product.goldSnapshot } : {}),
        })
      } else if (before?.productId !== product.id && prevAuto) {
        setRowAutoPrice(rowId, null)
      }
    },
    [draft, currency, bookCurrency, lineRate, activeSide, setRowAutoPrice],
  )

  // ─── Barcode scanner → invoice line ──────────────────────────────────────
  // A scan fills a DRAFT line (same product + unit again → +1). Nothing is
  // posted: stock, ledger and receivable move only when the invoice is issued.
  const [scanProblem, setScanProblem] = useState<ScanProblem | null>(null)
  // The scan dialog takes the device's keystrokes itself while it is open.
  const [scanDialogOpen, setScanDialogOpen] = useState(false)

  const placeScanned = useCallback(
    (product: Product, add = 1) => {
      // No id → nothing to link stock to; never a line that moves nothing.
      if (!product.id) return
      const unit = product.unit || 'piece'
      const dual = productDualBooksPrices(product)
      const booksPrice = activeSide === 'purchase' ? dual.buyBooksPrice : dual.sellBooksPrice
      const price = priceForInvoice(booksPrice, currency, bookCurrency, lineRate)
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
      const target = rowId
      const typed = useInvoiceDraftStore
        .getState()
        .rows.find((row) => row.id === target)
        ?.values[COLUMN.unitPrice]?.trim()
      draft.setRowProduct(rowId, product.id, product.name, price, unit)
      if (!typed) {
        setRowAutoPrice(rowId, {
          booksPrice,
          sellBooksPrice: dual.sellBooksPrice,
          buyBooksPrice: dual.buyBooksPrice,
          filled: price,
        })
      }
      if (add !== 1) draft.setCell(rowId, COLUMN.quantity, String(add))
    },
    [draft, activeSide, currency, bookCurrency, lineRate, setRowAutoPrice],
  )

  // A scale label's weight (or price ÷ unit price) is the quantity; an
  // ordinary code adds one. null = a price label the product cannot convert.
  const placeWithLabel = useCallback(
    (product: Product, label: ScaleLabel | undefined, barcode: string) => {
      if (!label) return placeScanned(product)
      const dual = productDualBooksPrices(product)
      const unitPrice = Number(
        (activeSide === 'purchase' ? dual.buyBooksPrice : dual.sellBooksPrice) || 0,
      )
      const quantity = quantityOfLabel(label, unitPrice)
      if (quantity === null) return setScanProblem({ kind: 'noUnitPrice', barcode })
      placeScanned(product, quantity)
    },
    [activeSide, placeScanned],
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
  useBarcodeScanner((scan) => void handleScan(scan.value), {
    enabled: scanProblem === null && !scanDialogOpen,
  })

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

  // A NEW invoice starts in the currency the books are kept in (the one chosen
  // when the business was set up) — not in whatever the last invoice used.
  // Only an untouched draft is moved: one being written keeps its currency.
  const startedInBooks = useRef(false)
  useEffect(() => {
    if (startedInBooks.current || !bookCurrency) return
    startedInBooks.current = true
    const untouched =
      draft.customers.length === 0 &&
      draft.rows.every(
        (row) => !row.productId && Object.values(row.values).every((value) => !value),
      )
    if (!untouched) return
    if (currency !== bookCurrency) {
      handleCurrencyChange(bookCurrency as CurrencyCode)
      return
    }
    // ⚠️ The columns too (live audit #78, 14 Oct). They are saved with the
    // draft and carry their own currency; a new afghani invoice opened with
    // «دالر» headers left by an earlier dollar one, and every such column
    // counted as deliberately pinned to dollars — which raised the second,
    // contradicting rate box (#68). A NEW draft has pinned nothing yet.
    if (
      draft.columns.some(
        (column) =>
          (column.type === 'currency' || column.type === 'computed') &&
          column.currency !== bookCurrency,
      )
    ) {
      draft.setColumns(
        draft.columns.map((column) =>
          column.type === 'currency' || column.type === 'computed'
            ? {
                ...column,
                currency: bookCurrency as CurrencyCode,
                precision: currencyPrecision(bookCurrency as CurrencyCode),
              }
            : column,
        ),
      )
    }
  }, [bookCurrency, currency, draft, draft.customers.length, draft.rows, handleCurrencyChange])

  // ⚠️ «ذخیره پیش‌نویس» WRITES (QA-005). It used to only say «saved» while the
  // draft stayed in this browser's storage: nothing reached the invoice list,
  // and another device never saw it. Now the draft is a row on the server
  // (user-state-01), listed under «پیش‌نویس‌ها» on the invoices page, and
  // saving again updates the same row.
  const saveDraftOnServer = useSaveInvoiceDraft()
  const toast = useToast()
  const handleSaveDraft = useCallback(() => {
    const state = useInvoiceDraftStore.getState()
    const names = state.customers.map((customer) => customer.name).filter(Boolean)
    const firstLine = state.rows
      .map((row) => (row.values[COLUMN.description] ?? '').trim())
      .find(Boolean)
    const title = [names.join('، '), firstLine].filter(Boolean).join(' · ').slice(0, 200)
    setSavingDraft(true)
    setSaveStatus('saving')
    saveDraftOnServer.mutate(
      {
        ...(state.serverDraftId ? { id: state.serverDraftId } : {}),
        kind: documentKind,
        title,
        payload: { ...invoiceDraftSnapshot(state) },
      },
      {
        onSuccess: (saved) => {
          if (saved?.id) state.setField('serverDraftId', saved.id)
          setSaveStatus('saved')
          toast.success(t('invoiceBuilder.draftSaved', 'پیش‌نویس ذخیره شد'))
          setTimeout(() => setSaveStatus('idle'), 1500)
        },
        onError: (error) => {
          setSaveStatus('idle')
          toast.error(
            apiErrorMessage(error, t('invoiceBuilder.draftSaveFailed', 'پیش‌نویس ذخیره نشد')),
          )
        },
        onSettled: () => setSavingDraft(false),
      },
    )
  }, [documentKind, saveDraftOnServer, setSaveStatus, t, toast])

  // Warn while the quantity is typed, not only on the preview (see the hook).
  const oversoldLines = useOversoldLines(items, draft.transactionType)

  // Customer terms: fill an empty due date, warn past the credit limit.
  const setDueDate = useCallback((value: string) => draft.setField('dueDate', value), [draft])
  const setWarehouseId = useCallback(
    (value: string | null) => draft.setField('warehouseId', value),
    [draft],
  )
  const setBranchId = useCallback(
    (value: string | null) => draft.setField('branchId', value),
    [draft],
  )
  const setExchangeRate = useCallback(
    (next: { from: string; to: string }) => {
      draft.setField('exchangeRateFrom', next.from)
      draft.setField('exchangeRateTo', next.to)
    },
    [draft],
  )
  // Live audit #60: the rate the business already saved for this currency
  // fills an EMPTY rate box — once per currency, the day's quote on or before
  // the invoice date. Whatever the person typed is never overwritten, and with
  // no saved rate the box stays empty and says so.
  const savedRates = useExchangeRates()
  const prefilledFor = useRef<string | null>(null)
  useEffect(() => {
    if (!bookCurrency || !needsExchangeRate(currency, bookCurrency)) return
    if (prefilledFor.current === currency) return
    if (draft.exchangeRateFrom.trim() || draft.exchangeRateTo.trim()) {
      prefilledFor.current = currency
      return
    }
    const quotes = asList<RateQuote>(savedRates.data)
    if (quotes.length === 0) return
    const saved = rateOn(quotes, currency, (draft.date || new Date().toISOString()).slice(0, 10))
    prefilledFor.current = currency
    if (saved !== null) setExchangeRate({ from: '1', to: String(saved) })
  }, [
    bookCurrency,
    currency,
    draft.date,
    draft.exchangeRateFrom,
    draft.exchangeRateTo,
    savedRates.data,
    setExchangeRate,
  ])

  const creditBreachInfo = useCustomerTerms({
    customerId: draft.customers[0]?.id,
    transactionType: draft.transactionType,
    date: draft.date,
    dueDate: draft.dueDate,
    invoiceTotal: summary.total,
    setDueDate,
  })

  const handleContinue = useCallback(() => {
    if (creditBreachInfo?.isBlocked) {
      return
    }
    push(
      activeAdvanceKind
        ? `/invoices/new/preview?type=${activeAdvanceKind}`
        : '/invoices/new/preview',
    )
  }, [creditBreachInfo?.isBlocked, push, activeAdvanceKind])
  const handleBackToList = useCallback(() => push('/invoices'), [push])

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
        scanSlot={
          <CameraScanButton
            t={t}
            onCode={(code) => void handleScan(code)}
            disabled={scanProblem !== null}
            onOpenChange={setScanDialogOpen}
          />
        }
        bookEquivalent={bookEquivalent}
        rateSlot={
          bookCurrency && needsExchangeRate(currency, bookCurrency) ? (
            <InvoiceExchangeRate
              t={t}
              invoiceCurrency={currency}
              bookCurrency={bookCurrency}
              from={draft.exchangeRateFrom}
              to={draft.exchangeRateTo}
              onChange={setExchangeRate}
            />
          ) : null
        }
        stockWarning={
          <>
            <InvoiceBranchSelect t={t} value={draft.branchId} onChange={setBranchId} />
            {/* An advance moves no stock: no warehouse to pick. */}
            {activeAdvanceKind ? null : (
              <InvoiceWarehouseSelect
                t={t}
                transactionType={activeSide}
                branchId={draft.branchId}
                value={draft.warehouseId}
                onChange={setWarehouseId}
              />
            )}
            <OversoldWarning t={t} lines={oversoldLines} />
            <CreditLimitWarning
              t={t}
              breach={creditBreachInfo}
              formatMoney={(value) => formatNumber(value, locale, 2)}
            />
          </>
        }
        customers={draft.customers}
        transactionType={documentKind}
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
        onPickVariant={draft.setRowVariant}
        onAddColumn={draft.addColumn}
        onUpdateColumn={draft.updateColumn}
        onSetColumnMultiplier={draft.setColumnMultiplier}
        onReplaceColumn={handleReplaceColumn}
        onRemoveColumn={draft.removeColumn}
        onMoveColumn={handleMoveColumn}
        onResetColumns={() => draft.resetColumns(currency)}
        onAddCustomer={draft.addCustomer}
        onRemoveCustomer={draft.removeCustomer}
        onTransactionTypeChange={handleDocumentKindChange}
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
InvoiceBuilderGrid.displayName = 'InvoiceBuilderGrid'
