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
import { Check, Pencil, Printer } from 'lucide-react'
import { useCreateInvoice, useCreateRecurringInvoice, useWorkspaces } from '@hisabche/api'
import {
  useBackupStore,
  useInvoiceDraftStore,
  useOnboardingStore,
  usePreferencesStore,
  useSyncStore,
} from '@hisabche/store'

import { Button } from '../../button'
import { useToast } from '../../toast-provider'
import { useActionAvailability } from '../../../../lib/capability/use-action-availability'
import { CloudRequiredNotice } from '../../cloud-required-notice'
import {
  InvoiceDocument,
  type InvoiceDocumentData,
  type InvoiceDocumentDisplaySettings,
} from '../../invoice-detail/invoice-document'
import {
  InvoicePaymentSection,
  emptyPaymentValue,
  paidAmountOf,
  paymentEntriesOf,
  type InvoicePaymentValue,
} from '../invoice-payment-section'
import { InvoiceSidebar } from '../../invoice-detail/invoice-sidebar'
import { useInvoiceDraft } from '../../../../hooks/invoices/use-invoice-draft'
import { PreviewItemsTable } from '../preview-items-table'
import { OversoldWarning } from '../oversold-warning'
import { InvoiceExchangeRate } from '../invoice-exchange-rate'
import { exchangeRateOf, needsExchangeRate } from '../../../../lib/invoices/exchange-rate'
import { invoiceInStoredMetal } from '../../../../lib/invoices/metal-amounts'
import { useBookCurrency } from '../../../../hooks/use-book-currency'
import { useTillChoice } from '../../../../hooks/use-till-choice'
import { TillSelectField } from '../../till/till-select-field'
import { useOversoldLines } from '../use-oversold-lines'
import { planLimitMessage } from '../../../../lib/plan-limit-message'
import { loadPrinterSettings } from '../../../../lib/print/printer-settings'
import { useLocalePush, useLocaleReplace } from '../../../../hooks/use-locale-push'
import {
  INITIAL_RECURRENCE,
  RecurrencePanel,
  cadenceFor,
  scheduleCalendarFor,
  type RecurrenceValue,
} from '../recurrence-panel'
import { nameOfCurrency } from '../../../../lib/currency-name'

const DEFAULT_DISPLAY: InvoiceDocumentDisplaySettings = {
  showSignature: true,
  showNotes: true,
  showBarcode: true,
}

export const InvoicePreviewContainer = memo(function InvoicePreviewContainer() {
  const localeReplace = useLocaleReplace()
  const push = useLocalePush()
  const createInvoice = useCreateInvoice()
  const createRecurring = useCreateRecurringInvoice()
  const [recurrence, setRecurrence] = useState<RecurrenceValue>(INITIAL_RECURRENCE)
  const toast = useToast()
  const { markInvoiceCreated } = useOnboardingStore()
  const preferences = usePreferencesStore()
  const { setSaveStatus } = useSyncStore()
  const { addAuditEntry } = useBackupStore()

  const { t, locale, currency, ctx, summary, issues, items } = useInvoiceDraft()
  const recurringAvailability = useActionAvailability('invoice.recurring')
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
  // ⚠️ ONE KEY PER DRAFT, NOT PER VISIT. The server may commit the invoice and
  // the answer never arrive (a 15 s timeout on the live site, 14 Oct). The key
  // lives in the draft (`submissionKey`), so submitting the same draft again
  // — now, or after leaving and coming back — returns the invoice that exists.
  const submissionKey = useInvoiceDraftStore((state) => state.submissionKey)

  // Reaching the preview with nothing to preview means the draft was cleared
  // in another tab or the URL was opened directly. Go back rather than
  // rendering an empty document.
  useEffect(() => {
    if (submittedRef.current) return
    if (items.length === 0) localeReplace('/invoices/new')
  }, [items.length, localeReplace])

  const { data: workspaces } = useWorkspaces()
  const workspace = Array.isArray(workspaces)
    ? (workspaces[0] as
        | {
            name?: string
            logo_url?: string | null
            stamp_url?: string | null
            signature_url?: string | null
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
  // One payment per row with money in it — for EVERY paying mode, so a full or
  // partial payment made through several methods is recorded as several.
  const paymentEntries = paymentEntriesOf(payment, summary.total)
  // More than the invoice is refused by the server; stop it here instead.
  const paymentBlocked = Math.round(paidAmount * 100) > Math.round(summary.total * 100)

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
        signatureUrl: workspace?.signature_url ?? null,
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
    // Unpaid has no payment row to carry its description; the invoice does.
    payment.mode === 'unpaid' && payment.note?.trim()
      ? `${t('invoiceBuilder.paymentNote', 'توضیحات')} (${t('invoiceBuilder.payMode.unpaid', 'پرداخت نشد')}): ${payment.note.trim()}`
      : '',
  ]
    .filter(Boolean)
    .join('\n')

  // Lines that will move no stock, because they name no warehouse product.
  const unlinkedLines = useMemo(
    () => items.filter((item) => !item.productId).map((item) => item.productName),
    [items],
  )

  // An invoice in another currency is booked at a rate, or not sent.
  const bookCurrency = useBookCurrency()
  const foreign = needsExchangeRate(currency, bookCurrency)
  const exchangeRate = exchangeRateOf(
    draft.exchangeRateFrom,
    draft.exchangeRateTo,
    currency,
    bookCurrency,
  )
  const rateMissing = foreign && exchangeRate === null

  // The cash of this invoice names its till: a sale's goes in, a purchase's
  // comes out. Only the cash part — and with nothing paid in cash, no till.
  const tillChoice = useTillChoice(currency)
  const cashPaid =
    paymentEntries.length > 0
      ? paymentEntries.some((entry) => entry.method === 'cash' && entry.amount > 0)
      : payment.method === 'cash' && paidAmount > 0
  const tillSessionId = cashPaid ? tillChoice.tillSessionId : ''

  // Shared with the form (/invoices/new) — see use-oversold-lines.ts.
  const oversoldLines = useOversoldLines(items, draft.transactionType)

  const handleConfirm = useCallback(async () => {
    if (issues.length || items.length === 0 || paymentBlocked || rateMissing) return
    // Decided BEFORE the invoice is created: an interval that is not a number
    // must stop the confirm, not be discovered after the sale is recorded.
    const cadence = recurrence.enabled
      ? cadenceFor(recurrence, draft.date, scheduleCalendarFor(locale))
      : null
    if (recurrence.enabled && !cadence) {
      setError(t('invoiceBuilder.recurrence.invalid', 'تعداد روز باید عددی بین ۱ تا ۳۶۶ باشد.'))
      return
    }
    setError(null)
    setSaveStatus('saving')

    try {
      // A metal invoice is typed in the unit shown (g / kg / t); the books
      // keep grams — converted here, once, at the boundary (metal-amounts.ts).
      const created = await createInvoice.mutateAsync(
        invoiceInStoredMetal({
          idempotencyKey: submissionKey,
          // Sent explicitly from the draft, never inferred from the route.
          type: draft.transactionType,
          date: draft.date,
          ...(draft.dueDate ? { dueDate: draft.dueDate } : {}),
          ...(draft.warehouseId ? { warehouseId: draft.warehouseId } : {}),
          ...(draft.branchId ? { branchId: draft.branchId } : {}),
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
          paymentMethod: paymentEntries[0]?.method ?? payment.method,
          // One payment record per method. A single row carrying a blended
          // method would make the till count and the bank reconciliation both
          // wrong, and neither repairable afterwards.
          ...(paymentEntries.length > 0
            ? {
                payments: paymentEntries.map((entry) => ({
                  method: entry.method,
                  amount: entry.amount,
                  ...(entry.note ? { note: entry.note } : {}),
                })),
              }
            : {}),
          currency,
          // Only on an invoice in another currency; the server refuses one without it.
          ...(foreign && exchangeRate !== null ? { exchangeRate } : {}),
          ...(tillSessionId ? { tillSessionId } : {}),
          ...(primaryCustomer?.id ? { customerId: primaryCustomer.id } : {}),
          // The companions are kept on the invoice's own notes — the only place
          // the current schema can hold them without inventing a relationship.
          ...(invoiceNotes ? { notes: invoiceNotes } : {}),
          items,
        }),
      )

      // The invoice just confirmed becomes the template of the arrangement —
      // the same lines, without this one's dates and payments. Only for an
      // invoice the server has actually recorded: one queued offline has not
      // been accepted yet, and an arrangement cannot be queued.
      if (cadence && !created.pendingSync && !recurringAvailability.requiresOnline) {
        const dueInDays = draft.dueDate
          ? Math.max(
              0,
              Math.round(
                (Date.parse(draft.dueDate.slice(0, 10)) - Date.parse(draft.date.slice(0, 10))) /
                  86_400_000,
              ),
            )
          : undefined
        try {
          await createRecurring.mutateAsync({
            name:
              recurrence.name.trim() ||
              `${primaryCustomer?.name ?? t('invoiceBuilder.recurrence.defaultName', 'فاکتور تکراری')}`,
            cadence,
            ...(dueInDays !== undefined ? { dueInDays } : {}),
            invoice: {
              type: draft.transactionType,
              ...(draft.warehouseId ? { warehouseId: draft.warehouseId } : {}),
              ...(draft.branchId ? { branchId: draft.branchId } : {}),
              subtotal: summary.subtotal,
              discountTotal: summary.discountTotal,
              discountType: draft.discountType,
              taxRate: Number(draft.taxRate) || 0,
              taxTotal: summary.taxTotal,
              total: summary.total,
              currency,
              ...(primaryCustomer?.id ? { customerId: primaryCustomer.id } : {}),
              ...(invoiceNotes ? { notes: invoiceNotes } : {}),
              items,
            },
          })
          toast.success(
            t('invoiceBuilder.recurrence.saved', 'این فاکتور از نوبت بعد خودکار صادر می‌شود.'),
          )
        } catch {
          // The invoice IS recorded; only the repeat was not set up. Said as
          // exactly that — not as a failed invoice, and not silently.
          toast.warning(
            t(
              'invoiceBuilder.recurrence.failedTitle',
              'فاکتور ثبت شد، ولی تکرار خودکار تنظیم نشد.',
            ),
            t(
              'invoiceBuilder.recurrence.failedHint',
              'می‌توانید دوباره از یک فاکتور تازه آن را روشن کنید.',
            ),
          )
        }
      } else if (cadence && created.pendingSync) {
        toast.warning(
          t(
            'invoiceBuilder.recurrence.offline',
            'تکرار خودکار فقط با اینترنت تنظیم می‌شود؛ این فاکتور تکرار نخواهد شد.',
          ),
        )
      }

      if (primaryCustomer) {
        preferences.setLastCustomer(primaryCustomer.name, primaryCustomer.id)
      }
      preferences.setLastCurrency(currency)
      markInvoiceCreated()

      // Queued on the device, not yet recorded: no number, no id to open. Say
      // exactly that, and go to the list — the header's pending count is the
      // receipt until the sync engine sends it.
      if (created.pendingSync) {
        setSaveStatus('idle')
        toast.info(
          t(
            'invoiceBuilder.savedOffline',
            'فاکتور روی این دستگاه ذخیره شد و به‌محض وصل شدن اینترنت ثبت می‌شود.',
          ),
        )
        submittedRef.current = true
        clearDraft()
        push('/invoices')
        return
      }

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
      // Auto-print (this device's receipt-printer setting): the detail page
      // prints once the SERVER's invoice has loaded — the committed numbers,
      // never the draft's. A printer failure there leaves this invoice as is.
      // (An offline-queued invoice returned above: it has no number yet, so
      // no receipt is printed for it.)
      const receipt = loadPrinterSettings().autoPrint ? '?action=receipt' : ''
      push(created.id ? `/invoices/${created.id}${receipt}` : '/invoices')
      // The column layout deliberately survives this — see the draft slice.
      clearDraft()
    } catch (cause) {
      setSaveStatus('idle')
      // The API client rejects with a plain object ({ message, code, status }),
      // not an Error — so the server's reason was always replaced by the
      // generic sentence, and nobody could tell WHICH step failed.
      const reason = (cause as { message?: unknown } | null)?.message
      const generic = t('invoiceBuilder.errors.createFailed', 'ثبت فاکتور ناموفق بود')
      // The plan's ceiling says what to do, not a code.
      const limit = planLimitMessage(cause, (key, values) => t(key, values as never))
      const code = (cause as { code?: unknown } | null)?.code
      const text = typeof reason === 'string' ? reason : ''
      // ⚠️ No answer is not «failed»: on the live site the server finished
      // INV-000081 after the 15 s client timeout, and the screen said it had
      // failed — an invitation to submit it twice.
      const unanswered = code === 'ECONNABORTED' || code === 'ETIMEDOUT' || /timeout/i.test(text)
      // A draft kept on the device can name a customer or product deleted
      // since; the server's English «Customer not found» was shown as is.
      const missing = /not found|INVOICE_REFERENCE_MISSING/i.test(text)
      setError(
        limit ??
          (unanswered
            ? t(
                'invoiceBuilder.errors.unanswered',
                'پاسخ سرور نرسید. ممکن است فاکتور ثبت شده باشد؛ پیش از تلاش دوباره فهرست فاکتورها را ببینید.',
              )
            : missing
              ? t(
                  'invoiceBuilder.errors.referenceMissing',
                  'مشتری یا کالایی که در این فاکتور است دیگر وجود ندارد؛ آن را دوباره انتخاب کنید.',
                )
              : text.trim()
                ? `${generic}: ${text}`
                : generic),
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
    paymentEntries,
    paymentBlocked,
    tillSessionId,
    createInvoice,
    createRecurring,
    recurringAvailability.requiresOnline,
    recurrence,
    locale,
    toast,
    t,
    preferences,
    markInvoiceCreated,
    addAuditEntry,
    setSaveStatus,
    clearDraft,
    push,
    t,
    toast,
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
          {foreign && bookCurrency ? (
            <InvoiceExchangeRate
              t={t}
              invoiceCurrency={currency}
              bookCurrency={bookCurrency}
              from={draft.exchangeRateFrom}
              to={draft.exchangeRateTo}
              onChange={(next) => {
                draft.setField('exchangeRateFrom', next.from)
                draft.setField('exchangeRateTo', next.to)
              }}
            />
          ) : null}
          <InvoicePaymentSection
            t={t}
            fmtMoney={(value) => value.toLocaleString('fa-AF')}
            currency={currency}
            total={summary.total}
            value={payment}
            onChange={setPayment}
          />
          {cashPaid ? (
            <div className="rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] p-3">
              <TillSelectField
                t={t}
                choice={tillChoice}
                direction={draft.transactionType === 'purchase' ? 'out' : 'in'}
              />
            </div>
          ) : null}

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
                    {nameOfCurrency(t, entry.currency, entry.currency)}
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
          <OversoldWarning t={t} lines={oversoldLines} />
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

          {recurringAvailability.requiresOnline ? (
            <CloudRequiredNotice
              variant="inline"
              title={t('invoiceBuilder.recurrence.title', 'فاکتور تکراری')}
              description={t('offline.cloudRequired.description')}
            />
          ) : (
            <RecurrencePanel
              t={t}
              value={recurrence}
              onChange={setRecurrence}
              invoiceDate={draft.date}
              calendar={scheduleCalendarFor(locale)}
              disabled={createInvoice.isPending}
            />
          )}

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
              disabled={issues.length > 0 || paymentBlocked || rateMissing}
              fullWidth
              className="gap-1.5"
            >
              <Check className="size-4" aria-hidden="true" />
              {t('invoiceBuilder.confirmCreate', 'تأیید و ثبت فاکتور')}
            </Button>
            <Button
              variant="outline"
              onClick={() => push('/invoices/new')}
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
            {`${summary.total.toLocaleString(locale)} ${nameOfCurrency(t, currency, currency)}`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => push('/invoices/new')}
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
            disabled={issues.length > 0 || paymentBlocked || rateMissing}
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
