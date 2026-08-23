// ============================================
// STEP 2 of 2 — the preview, and the only place the invoice is created.
//
// A separate route, not a panel under the builder. It reads the same draft
// store, so what it prints is what was typed; and it submits through the
// existing `useCreateInvoice`, so no second financial implementation exists.
// The server remains authoritative — these figures are for the human.
// ============================================
'use client'

import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Pencil, Printer } from 'lucide-react'
import { useCreateInvoice, useWorkspaces } from '@hisabche/api'
import {
  useBackupStore,
  useInvoiceDraftStore,
  useOnboardingStore,
  usePreferencesStore,
  useSyncStore,
} from '@hisabche/store'

import { Button } from '../../button'
import {
  InvoiceDocument,
  type InvoiceDocumentData,
  type InvoiceDocumentDisplaySettings,
} from '../../invoice-detail/invoice-document'
import { InvoiceSidebar } from '../../invoice-detail/invoice-sidebar'
import { useInvoiceDraft } from '../../../../hooks/invoices/use-invoice-draft'
import { PreviewItemsTable } from '../preview-items-table'

const DEFAULT_DISPLAY: InvoiceDocumentDisplaySettings = {
  showSignature: true,
  showNotes: true,
  showBarcode: true,
}

export const InvoicePreviewContainer = memo(function InvoicePreviewContainer() {
  const router = useRouter()
  const createInvoice = useCreateInvoice()
  const { markInvoiceCreated } = useOnboardingStore()
  const preferences = usePreferencesStore()
  const { setSaveStatus } = useSyncStore()
  const { addAuditEntry } = useBackupStore()

  const { t, locale, currency, ctx, summary, issues, items } = useInvoiceDraft()
  const draft = useInvoiceDraftStore()
  const clearDraft = useInvoiceDraftStore((s) => s.clearDraft)

  const [display, setDisplay] = useState<InvoiceDocumentDisplaySettings>(DEFAULT_DISPLAY)
  const [error, setError] = useState<string | null>(null)

  // Reaching the preview with nothing to preview means the draft was cleared
  // in another tab or the URL was opened directly. Go back rather than
  // rendering an empty document.
  useEffect(() => {
    if (items.length === 0) router.replace('/invoices/new')
  }, [items.length, router])

  const { data: workspaces } = useWorkspaces()
  const workspace = Array.isArray(workspaces)
    ? (workspaces[0] as
        | {
            name?: string
            logo_url?: string | null
            stamp_url?: string | null
            phone?: string | null
            address?: string | null
          }
        | undefined)
    : undefined

  const documentData: InvoiceDocumentData = useMemo(
    () => ({
      // Not saved yet, so there is no invoice number and none is invented.
      invoiceNumber: undefined,
      type: draft.transactionType,
      date: draft.date,
      dueDate: draft.dueDate,
      business: {
        name: workspace?.name || t('app.name', 'حسابچه'),
        logoUrl: workspace?.logo_url ?? null,
        stampUrl: workspace?.stamp_url ?? null,
        phone: workspace?.phone ?? null,
        address: workspace?.address ?? null,
      },
      customer: draft.customer
        ? {
            name: draft.customer.name,
            phone: draft.customer.phone ?? null,
            email: draft.customer.email ?? null,
            address: draft.customer.address ?? null,
          }
        : null,
      // The document's own table is replaced by `itemsSlot`; these carry the
      // money rows the footer totals read.
      items: items.map((item, index) => ({
        id: String(index),
        productName: item.productName,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        discount: item.discount,
        totalPrice: item.totalPrice,
      })),
      currency,
      subtotal: summary.subtotal,
      discountTotal: summary.discountTotal,
      taxTotal: summary.taxTotal,
      total: summary.total,
      paidAmount: draft.isPaid ? summary.total : 0,
      notes: draft.notes,
    }),
    [draft, workspace, items, currency, summary, t],
  )

  const handleConfirm = useCallback(async () => {
    if (issues.length || items.length === 0) return
    setError(null)
    setSaveStatus('saving')

    try {
      const created = await createInvoice.mutateAsync({
        // Sent explicitly from the draft, never inferred from the route.
        type: draft.transactionType,
        date: draft.date,
        ...(draft.dueDate ? { dueDate: draft.dueDate } : {}),
        subtotal: summary.subtotal,
        discountTotal: summary.discountTotal,
        discountType: draft.discountType,
        taxRate: Number(draft.taxRate) || 0,
        taxTotal: summary.taxTotal,
        total: summary.total,
        paidAmount: draft.isPaid ? summary.total : Number(draft.paidNow) || 0,
        paymentMethod: draft.paymentMethod,
        currency,
        ...(draft.customer?.id ? { customerId: draft.customer.id } : {}),
        ...(draft.notes ? { notes: draft.notes } : {}),
        items,
      })

      if (draft.customer) {
        preferences.setLastCustomer(draft.customer.name, draft.customer.id)
      }
      preferences.setLastCurrency(currency)
      markInvoiceCreated()

      addAuditEntry({
        action: 'create',
        entity: 'invoice',
        entityId: created.id || '',
        details: `${t('invoiceBuilder.new', 'فاکتور جدید')}: ${summary.total} ${currency}`,
      })

      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)

      // Only now is the draft safe to discard — the column layout survives it.
      clearDraft()
      router.push(created.id ? `/invoices/${created.id}` : '/invoices')
    } catch (cause) {
      setSaveStatus('idle')
      setError(
        cause instanceof Error
          ? cause.message
          : t('invoiceBuilder.errors.createFailed', 'ثبت فاکتور ناموفق بود'),
      )
    }
  }, [
    issues.length,
    items,
    draft,
    summary,
    currency,
    createInvoice,
    preferences,
    markInvoiceCreated,
    addAuditEntry,
    setSaveStatus,
    clearDraft,
    router,
    t,
  ])

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-4 pb-24 lg:pb-6">
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-[hsl(var(--fg-primary))]">
          {t('invoiceBuilder.previewTitle', 'پیش‌نمایش و تأیید فاکتور')}
        </h1>
        <p className="mt-1 text-xs text-[hsl(var(--fg-tertiary))]">
          {t('invoiceBuilder.stepTwo', 'مرحله ۲: بررسی و ثبت نهایی')}
        </p>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[1fr_18rem]">
        <div className="min-w-0">
          <InvoiceDocument
            t={t}
            data={documentData}
            display={display}
            locale={locale}
            itemsSlot={
              <PreviewItemsTable
                t={t}
                locale={locale}
                columns={draft.columns}
                rows={draft.rows}
                ctx={ctx}
              />
            }
          />
        </div>

        <div className="min-w-0 space-y-3">
          <InvoiceSidebar
            t={t}
            summary={{
              total: summary.total,
              paidAmount: draft.isPaid ? summary.total : 0,
              currency,
            }}
            display={display}
            onDisplayChange={(key, value) => setDisplay((prev) => ({ ...prev, [key]: value }))}
          />

          {summary.foreignTotals.length ? (
            <div className="rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] p-3">
              <p className="mb-1.5 text-xs font-medium text-[hsl(var(--fg-secondary))]">
                {t('invoiceBuilder.summary.foreignSection', 'جمع ارزهای دیگر')}
              </p>
              {summary.foreignTotals.map((entry) => (
                <p key={entry.currency} className="flex justify-between text-xs">
                  <span className="text-[hsl(var(--fg-tertiary))]">
                    {t(`currency.${entry.currency.toLowerCase()}`, entry.currency)}
                  </span>
                  <span dir="ltr" className="tabular-nums text-[hsl(var(--fg-primary))]">
                    {entry.amount.toLocaleString(locale)}
                  </span>
                </p>
              ))}
            </div>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="rounded-[var(--radius-md)] border border-[hsl(var(--color-destructive)/0.4)] bg-[hsl(var(--color-destructive)/0.06)] p-3 text-xs text-[hsl(var(--color-destructive))]"
            >
              {error}
            </p>
          ) : null}

          <div className="hidden flex-col gap-2 lg:flex">
            <Button
              onClick={handleConfirm}
              loading={createInvoice.isPending}
              disabled={issues.length > 0}
              fullWidth
              className="gap-1.5"
            >
              <Check className="size-4" aria-hidden="true" />
              {t('invoiceBuilder.confirmCreate', 'تأیید و ساخت فاکتور')}
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push('/invoices/new')}
              disabled={createInvoice.isPending}
              fullWidth
              className="gap-1.5"
            >
              <Pencil className="size-4" aria-hidden="true" />
              {t('invoiceBuilder.backToEdit', 'بازگشت به ویرایش')}
            </Button>
            <Button
              variant="ghost"
              onClick={() => window.print()}
              fullWidth
              className="gap-1.5 print:hidden"
            >
              <Printer className="size-4" aria-hidden="true" />
              {t('common.print', 'چاپ')}
            </Button>
          </div>
        </div>
      </div>

      {/* Phone and tablet keep the two decisions within thumb reach. */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 border-t border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-3 lg:hidden print:hidden">
        <Button
          variant="outline"
          onClick={() => router.push('/invoices/new')}
          disabled={createInvoice.isPending}
          className="shrink-0"
        >
          <Pencil className="size-4" aria-hidden="true" />
          <span className="sr-only">{t('invoiceBuilder.backToEdit', 'بازگشت به ویرایش')}</span>
        </Button>
        <Button
          onClick={handleConfirm}
          loading={createInvoice.isPending}
          disabled={issues.length > 0}
          fullWidth
          className="gap-1.5"
        >
          <Check className="size-4" aria-hidden="true" />
          {t('invoiceBuilder.confirmCreate', 'تأیید و ساخت فاکتور')}
        </Button>
      </div>
    </div>
  )
})

InvoicePreviewContainer.displayName = 'InvoicePreviewContainer'
