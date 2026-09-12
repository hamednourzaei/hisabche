// ============================================
// STEP 2 of 2 — the preview, and the only place the invoice is created.
//
// A separate route, not a panel under the builder. It reads the same draft
// store, so what it prints is what was typed; and it submits through the
// existing `useCreateInvoice`, so no second financial implementation exists.
// The server remains authoritative — these figures are for the human.
// ============================================
'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import {
  InvoicePaymentSection,
  emptyPaymentValue,
  paidAmountOf,
  type InvoicePaymentValue,
} from '../invoice-payment-section'
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

  /**
   * Set the moment the invoice is created, and never unset.
   *
   * Confirming clears the draft, which empties `items` — and the guard below
   * would then fire `replace('/invoices/new')` into the same tick as the
   * `push('/invoices/:id')` that just succeeded. The two navigations raced:
   * sometimes the user landed back on an empty builder, sometimes the router
   * wedged between the two. This flag makes the guard stand down once the
   * invoice exists, so the push is the only navigation in flight.
   */
  const submittedRef = useRef(false)

  // Reaching the preview with nothing to preview means the draft was cleared
  // in another tab or the URL was opened directly. Go back rather than
  // rendering an empty document.
  useEffect(() => {
    if (submittedRef.current) return
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

  const primaryCustomer = draft.customers[0] ?? null
  const otherCustomerNames = draft.customers
    .slice(1)
    .map((c) => c.name)
    .join('، ')

  // ─── T9 — how this invoice was paid ─────────────────────────────────
  //
  // `draft.isPaid` defaulted to TRUE and no UI ever set it, so every invoice
  // was submitted claiming the full amount had been received. That is the
  // reported defect at its source: `paidAmount: summary.total` on a sale where
  // nothing had been handed over.
  //
  // Held in local state rather than the draft slice because it describes an
  // EVENT at submission, not a property of the document being edited — and
  // because a persisted default is exactly what caused the bug.
  const [payment, setPayment] = useState<InvoicePaymentValue>(emptyPaymentValue)
  const paidAmount = paidAmountOf(payment, summary.total)

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
      customer: primaryCustomer
        ? {
            // Additional parties are named next to the primary one, so the
            // printed document shows everyone the invoice was issued to even
            // though only the first carries the receivable.
            name: otherCustomerNames
              ? `${primaryCustomer.name} + ${otherCustomerNames}`
              : primaryCustomer.name,
            phone: primaryCustomer.phone ?? null,
            email: primaryCustomer.email ?? null,
            address: primaryCustomer.address ?? null,
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
      paidAmount,
      notes: draft.notes,
    }),
    // ⚠️ `paidAmount` IS A DEPENDENCY, AND IT WAS MISSING.
    //
    // The memo body reads it, so leaving it out froze the printed document on
    // the paid amount from the FIRST render — zero. Someone could enter a
    // payment, watch the total update beside the form, and print a document
    // still saying nothing had been received. A stale number on a document
    // that leaves the building is worse than a visibly wrong one on screen.
    [
      draft,
      primaryCustomer,
      otherCustomerNames,
      workspace,
      items,
      currency,
      summary,
      paidAmount,
      t,
    ],
  )

  const invoiceNotes = [
    draft.notes.trim(),
    otherCustomerNames
      ? `${t('invoiceBuilder.customer.otherParties', 'سایر طرف‌های فاکتور')}: ${otherCustomerNames}`
      : '',
  ]
    .filter(Boolean)
    .join('\n')

  // Lines that will move no stock, because they name no warehouse product.
  const unlinkedLines = useMemo(
    () => items.filter((item) => !item.productId).map((item) => item.productName),
    [items],
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
        // ⚠️ The server turns these into REAL `payments` +
        // `payment_allocations` rows. It no longer stamps `paid_amount` — see
        // `recordCreationPayments` in invoice.service.ts.
        paidAmount,
        paymentMethod: payment.method,
        // Split: one payment record per method. A single row carrying a
        // blended method would make the till count and the bank
        // reconciliation both wrong, and neither repairable afterwards.
        ...(payment.mode === 'split'
          ? {
              payments: payment.tranches
                .filter((tranche) => (Number(tranche.amount) || 0) > 0)
                .map((tranche) => ({
                  method: tranche.method,
                  amount: Number(tranche.amount),
                })),
            }
          : {}),
        currency,
        ...(primaryCustomer?.id ? { customerId: primaryCustomer.id } : {}),
        // The companions are kept on the invoice's own notes — the only place
        // the current schema can hold them without inventing a relationship.
        ...(invoiceNotes ? { notes: invoiceNotes } : {}),
        items,
      })

      if (primaryCustomer) {
        preferences.setLastCustomer(primaryCustomer.name, primaryCustomer.id)
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

      // Order matters. Claim the guard first, navigate second, clear third:
      // clearing empties `items`, and any re-render between the clear and the
      // push would otherwise bounce back to the builder.
      submittedRef.current = true
      router.push(created.id ? `/invoices/${created.id}` : '/invoices')
      // The column layout deliberately survives this — see the draft slice.
      clearDraft()
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
    primaryCustomer,
    invoiceNotes,
    summary,
    currency,
    paidAmount,
    payment,
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
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-4 pb-40 lg:pb-6">
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
          <InvoicePaymentSection
            t={t}
            fmtMoney={(value) => value.toLocaleString('fa-AF')}
            currency={currency}
            total={summary.total}
            value={payment}
            onChange={setPayment}
          />

          <InvoiceSidebar
            t={t}
            summary={{
              total: summary.total,
              paidAmount,
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

          {/*
            ⚠️ SAID AT THE MOMENT OF COMMITTING, NOT AS A MISSING ICON.

            A line typed as free text is a legitimate invoice line — services,
            one-off items, anything not in the catalogue — and it moves no
            stock, correctly. The grid already marks a LINKED line with a green
            package icon.

            But the ABSENCE of a mark is not a signal. Somebody has to already
            know the icon exists to notice that it is missing, and nobody
            checking their warehouse afterwards was told anything at all. Three
            invoices were entered with names that matched no product in the
            catalogue; every one of them saved cleanly, and the stock figure
            never moved. The person reasonably concluded the stock feature was
            broken.

            This is NOT an error and does not block the save — saying "you
            cannot do this" would be false. It states what will happen, while
            there is still a chance to link the line instead.
          */}
          {unlinkedLines.length > 0 ? (
            <div className="rounded-[var(--radius-md)] border border-[hsl(var(--color-warning)/0.4)] bg-[hsl(var(--color-warning)/0.06)] p-3">
              <p className="text-xs font-medium text-[hsl(var(--color-warning))]">
                {t(
                  'invoiceBuilder.notLinkedTitle',
                  'این خط‌ها به محصول انبار وصل نیستند و موجودی را تغییر نمی‌دهند',
                )}
              </p>
              <p className="mt-1 text-xs text-[hsl(var(--fg-secondary))]">
                {unlinkedLines.join('، ')}
              </p>
              <p className="mt-1.5 text-[11px] text-[hsl(var(--fg-tertiary))]">
                {t(
                  'invoiceBuilder.notLinkedHint',
                  'برای کم شدن موجودی، محصول را از فهرست انبار انتخاب کنید.',
                )}
              </p>
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
              {t('invoiceBuilder.confirmCreate', 'تأیید و ثبت فاکتور')}
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

      {/* Phone and tablet: the amount being committed sits directly above the
          button that commits it, both inside the safe area. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden print:hidden">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <span className="text-sm text-[hsl(var(--fg-secondary))]">
            {t('invoiceBuilder.summary.payable', 'مبلغ قابل پرداخت')}
          </span>
          <span dir="ltr" className="text-xl font-bold tabular-nums text-[hsl(var(--fg-primary))]">
            {`${summary.total.toLocaleString(locale)} ${t(`currency.${currency.toLowerCase()}`, currency)}`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => router.push('/invoices/new')}
            disabled={createInvoice.isPending}
            className="h-12 shrink-0 px-4"
          >
            <Pencil className="size-4" aria-hidden="true" />
            <span className="sr-only">{t('invoiceBuilder.backToEdit', 'بازگشت به ویرایش')}</span>
          </Button>
          <Button
            variant="success"
            onClick={handleConfirm}
            loading={createInvoice.isPending}
            disabled={issues.length > 0}
            fullWidth
            className="h-12 gap-1.5 text-base"
          >
            <Check className="size-4" aria-hidden="true" />
            {t('invoiceBuilder.confirmCreate', 'تأیید و ثبت فاکتور')}
          </Button>
        </div>
      </div>
    </div>
  )
})

InvoicePreviewContainer.displayName = 'InvoicePreviewContainer'
