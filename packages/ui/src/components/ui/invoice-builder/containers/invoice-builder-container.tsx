// ============================================
// STEP 1 container. Owns navigation intent and the draft store; every number
// it shows comes from `useInvoiceDraft`.
// ============================================
'use client'

import { memo, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { COLUMN, currencyPrecision, moveColumn, type InvoiceColumn } from '@hisabche/validation'
import {
  useCurrencyStore,
  useInvoiceDraftStore,
  useSyncStore,
  type CurrencyCode,
} from '@hisabche/store'

import { useInvoiceDraft } from '../../../../hooks/invoices/use-invoice-draft'
import { InvoiceBuilderPage } from '../invoice-builder-page'

export const InvoiceBuilderContainer = memo(function InvoiceBuilderContainer() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setSaveStatus } = useSyncStore()
  const { t, locale, currency, ctx, summary, invalidRowIds, issues } = useInvoiceDraft()

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

  const handleContinue = useCallback(() => router.push('/invoices/new/preview'), [router])
  const handleBackToList = useCallback(() => router.push('/invoices'), [router])

  return (
    <InvoiceBuilderPage
      t={t}
      locale={locale}
      columns={draft.columns}
      rows={draft.rows}
      ctx={ctx}
      summary={summary}
      invalidRowIds={invalidRowIds}
      issues={issues}
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
  )
})

InvoiceBuilderContainer.displayName = 'InvoiceBuilderContainer'
