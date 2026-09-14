'use client'

// ============================================
// packages/ui/src/components/ui/invoice-detail/invoice-related-panel.tsx
//
// H2 — what an invoice's «پرداخت‌شده» figure is actually made of, and the
// accounting entry the invoice produced.
//
// ---------------------------------------------------------------------------
// WHY THIS IS NOT PART OF THE SIDEBAR
//
// `InvoiceSidebar` is shared with the quick-invoice PREVIEW step, where the
// invoice does not exist yet — it has no id, no allocations and no journal
// entry. Putting this there would mean a panel that must render nothing on
// half its call sites, which is how a component ends up with a `mode` prop.
//
// ---------------------------------------------------------------------------
// WHAT IT SHOWS WHEN THERE IS NOTHING TO SHOW
//
// Both empty states are explicit and DIFFERENT, because they mean different
// things:
//
//   • no payments      → the invoice is genuinely unsettled.
//   • no journal entry → the invoice was never posted. That is either an
//     invoice awaiting approval (G6 holds the ledger until then) or a real
//     defect — and the second is worth seeing rather than hiding behind a
//     blank area.
//
// A silent empty box would read as «loading» for both.
// ============================================

import { AlertCircle, BookOpen, Receipt } from 'lucide-react'

import * as React from 'react'

import {
  AddPaymentButton,
  CancelPaymentButton,
  RecordPaymentForm,
  type PaymentMethod,
} from './record-payment-form'
import { cn } from '../../../lib/utils'

export interface InvoiceRelatedPayment {
  paymentId: string
  allocationId: string
  amount: number
  date: string | null
  method: string | null
  reference: string | null
  status: string | null
}

export interface InvoiceRelatedJournal {
  id: string
  entryNumber: string | null
  date: string | null
  status: string | null
}

export interface InvoiceRelatedPanelProps {
  t: (key: string, fallback?: string) => string
  fmtMoney: (value: number) => string
  fmtDate: (value: string) => string
  currency: string
  isLoading: boolean
  payments: InvoiceRelatedPayment[]
  journalEntry: InvoiceRelatedJournal | null
  /** Σ of the allocations — what `paid_amount` is a cache of. */
  allocatedTotal: number
  /**
   * `paid_amount` as stored on the invoice.
   *
   * Shown ONLY when it disagrees with the sum of the allocations. Phase F made
   * it a trigger-maintained projection, so a difference means the projection
   * has drifted — the one thing a person looking at this panel needs told.
   */
  storedPaidAmount: number
  onOpenJournalEntry?: ((id: string) => void) | undefined

  // ─── T9 — recording and unrecording money ─────────────────────────────
  //
  // All optional. The panel is used in read-only contexts (the public invoice
  // view, the PDF preview) where offering an «افزودن پرداخت» button would be
  // an action nobody there can take. Omit the handlers and the controls are
  // not rendered at all — they are not rendered-and-disabled, which reads as
  // «you lack permission» rather than «not applicable here».

  /** The invoice total, so the form can cap a payment at what is still owed. */
  invoiceTotal?: number | undefined
  /** Provide to show «افزودن پرداخت». */
  /** The payments could not be read: totals are unknown, not zero. */
  relatedFailed?: boolean | undefined
  onRetryRelated?: (() => void) | undefined
  onRecordPayment?:
    | ((input: { amount: number; method: string; reference: string; date: string }) => void)
    | undefined
  /** Provide to show the per-row remove control. */
  onCancelPayment?: ((paymentId: string) => void) | undefined
  isRecordingPayment?: boolean | undefined
  recordPaymentError?: string | null | undefined

  /** Provide to offer «ثبت در دفتر» when the invoice has no journal entry. */
  onPostToLedger?: (() => void) | undefined
  isPostingToLedger?: boolean | undefined
  /** Why the last post attempt did not book, already translated. */
  ledgerPostMessage?: string | null | undefined
}

const card =
  'rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4'

export function InvoiceRelatedPanel({
  t,
  fmtMoney,
  fmtDate,
  currency,
  isLoading,
  payments,
  journalEntry,
  allocatedTotal,
  storedPaidAmount,
  onOpenJournalEntry,
  invoiceTotal,
  relatedFailed,
  onRetryRelated,
  onRecordPayment,
  onCancelPayment,
  isRecordingPayment,
  recordPaymentError,
  onPostToLedger,
  isPostingToLedger,
  ledgerPostMessage,
}: InvoiceRelatedPanelProps) {
  const [adding, setAdding] = React.useState(false)
  // Close the form only once the server has ACCEPTED the payment. Closing on
  // submit hid every refusal: the request failed with a 400 and the only trace
  // was a line in the browser console.
  const wasRecording = React.useRef(false)
  React.useEffect(() => {
    if (wasRecording.current && !isRecordingPayment && !recordPaymentError) setAdding(false)
    wasRecording.current = Boolean(isRecordingPayment)
  }, [isRecordingPayment, recordPaymentError])
  if (isLoading) {
    return <div className={cn(card, 'h-40 animate-pulse bg-[hsl(var(--surface-muted))]')} />
  }

  // Compared in minor units. A float comparison on money reports a difference
  // of 0.0000001 as drift and hides a real one of half a cent (lesson 9).
  // Unread payments are not «no payments»: no drift claim until they are read.
  const drifted =
    !relatedFailed && Math.round(allocatedTotal * 100) !== Math.round(storedPaidAmount * 100)
  const fullyPaid =
    !relatedFailed &&
    (invoiceTotal ?? 0) > 0 &&
    Math.round(allocatedTotal * 100) >= Math.round((invoiceTotal ?? 0) * 100)

  // ⚠️ FROM THE ALLOCATIONS, NEVER FROM `storedPaidAmount`.
  //
  // `paid_amount` is the cached projection, and this panel exists precisely
  // because it can drift. Capping a new payment against the drifted number
  // would let the drift decide how much more the customer may pay.
  const outstanding = Math.max(0, (invoiceTotal ?? 0) - allocatedTotal)

  return (
    <div className="space-y-4">
      {/* ─── Payments ─────────────────────────────────────────────────── */}
      <section className={card}>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[hsl(var(--fg-primary))]">
          <Receipt className="size-4 text-[hsl(var(--color-primary))]" aria-hidden="true" />
          {t('invoiceDetail.payments', 'پرداخت‌های این فاکتور')}
          {onRecordPayment && !adding ? (
            <span className="ms-auto">
              <AddPaymentButton
                t={t}
                onClick={() => setAdding(true)}
                // Nothing left to pay is not an error state, so the control is
                // simply unavailable rather than offering a form that the
                // server would refuse.
                disabled={outstanding <= 0}
              />
            </span>
          ) : null}
        </h2>

        {relatedFailed ? (
          <p
            className="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-[hsl(var(--color-warning)/0.12)] px-3 py-2 text-xs text-[hsl(var(--color-warning))]"
            role="alert"
          >
            <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
            {t(
              'invoiceDetail.paymentsReadFailed',
              'پرداخت‌های این فاکتور خوانده نشد؛ تا خوانده نشود ثبت پرداخت ممکن نیست.',
            )}
            {onRetryRelated ? (
              <button type="button" className="underline" onClick={onRetryRelated}>
                {t('common.retry', 'تلاش دوباره')}
              </button>
            ) : null}
          </p>
        ) : null}

        {onRecordPayment && adding ? (
          <div className="mb-3">
            <RecordPaymentForm
              t={t}
              fmtMoney={fmtMoney}
              currency={currency}
              outstanding={outstanding}
              isSubmitting={Boolean(isRecordingPayment)}
              error={recordPaymentError ?? null}
              onCancel={() => setAdding(false)}
              onSubmit={(input) => onRecordPayment(input)}
            />
          </div>
        ) : null}

        {payments.length === 0 ? (
          <p className="text-sm text-[hsl(var(--fg-tertiary))]">
            {t('invoiceDetail.noPayments', 'هنوز پرداختی برای این فاکتور ثبت نشده است.')}
          </p>
        ) : (
          <>
            <ul className="space-y-2">
              {payments.map((payment) => (
                <li
                  key={payment.allocationId}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[hsl(var(--border-default))] px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-[hsl(var(--fg-primary))]">
                      {payment.date
                        ? fmtDate(payment.date)
                        : t('common.unknownDate', 'تاریخ نامشخص')}
                    </p>
                    <p className="truncate text-xs text-[hsl(var(--fg-tertiary))]">
                      {[payment.method, payment.reference].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                  {/* The amount ALLOCATED to this invoice, not the payment's
                      own total — one payment can settle several invoices, and
                      showing its full amount here would overstate this one. */}
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-[hsl(var(--fg-primary))]">
                    {fmtMoney(payment.amount)} {currency}
                  </span>

                  {onCancelPayment ? (
                    <CancelPaymentButton
                      t={t}
                      // An already-cancelled payment cannot be cancelled
                      // again; the server answers PAYMENT_NOT_CANCELLABLE.
                      disabled={payment.status === 'cancelled'}
                      onClick={() => onCancelPayment(payment.paymentId)}
                    />
                  ) : null}
                </li>
              ))}
            </ul>

            <div className="mt-3 flex items-center justify-between border-t border-[hsl(var(--border-default))] pt-3 text-sm">
              <span className="text-[hsl(var(--fg-secondary))]">
                {t('invoiceDetail.allocatedTotal', 'مجموع تخصیص‌یافته')}
              </span>
              <span className="font-semibold tabular-nums text-[hsl(var(--fg-primary))]">
                {fmtMoney(allocatedTotal)} {currency}
              </span>
            </div>
          </>
        )}

        {fullyPaid && !drifted ? (
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-[hsl(var(--color-success)/0.12)] px-3 py-2 text-xs font-medium text-[hsl(var(--color-success))]">
            <Receipt className="size-3.5 shrink-0" aria-hidden="true" />
            {t('invoiceDetail.fullyPaid', 'پرداخت کامل شده است')}
          </p>
        ) : null}

        {drifted ? (
          // Phase F made `paid_amount` a projection of these rows. If the two
          // disagree the trigger did not run — silence here would leave a
          // receivables report that quietly contradicts the payments.
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-[hsl(var(--color-warning)/0.12)] px-3 py-2 text-xs text-[hsl(var(--color-warning))]">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>
              {allocatedTotal === 0
                ? // The common case: marked paid at creation, no payment record.
                  t(
                    'invoiceDetail.paidWithoutRecord',
                    'این فاکتور «پرداخت‌شده» علامت خورده ولی هیچ رکورد پرداختی پشت آن نیست؛ تا ثبت نشود در صندوق، دفتر و گزارش بدهی دیده نمی‌شود.',
                  )
                : t(
                    'invoiceDetail.paidAmountDrift',
                    'مبلغ پرداخت‌شده‌ی ثبت‌شده روی فاکتور با مجموع پرداخت‌ها یکی نیست',
                  )}
              {': '}
              <span className="tabular-nums">
                {fmtMoney(storedPaidAmount)} ≠ {fmtMoney(allocatedTotal)}
              </span>
            </span>
          </p>
        ) : null}

        {/* ⚠️ THE USUAL CAUSE, AND ITS FIX. An invoice marked «paid» when it
            was created carries a paid amount with no payment record behind it
            — so the page says it is paid AND offers «افزودن پرداخت». Recording
            the missing amount as a payment makes the two agree; the invoice's
            paid amount is recomputed from the payments, not added to. */}
        {drifted && onRecordPayment && storedPaidAmount > allocatedTotal ? (
          <button
            type="button"
            disabled={Boolean(isRecordingPayment)}
            onClick={() =>
              onRecordPayment({
                amount: Math.round((storedPaidAmount - allocatedTotal) * 100) / 100,
                method: '',
                reference: '',
                date: '',
              })
            }
            className={cn(
              'mt-2 inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-medium',
              'bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))]',
              'hover:bg-[hsl(var(--color-primary)/0.2)] disabled:opacity-60',
            )}
          >
            <Receipt className="size-3.5" aria-hidden="true" />
            {t('invoiceDetail.recordMissingPayment', 'ثبت رکورد پرداخت برای این مبلغ')}
            <span className="tabular-nums">
              {fmtMoney(storedPaidAmount - allocatedTotal)} {currency}
            </span>
          </button>
        ) : null}
      </section>

      {/* ─── Journal entry ────────────────────────────────────────────── */}
      <section className={card}>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[hsl(var(--fg-primary))]">
          <BookOpen className="size-4 text-[hsl(var(--color-primary))]" aria-hidden="true" />
          {t('invoiceDetail.journalEntry', 'سند حسابداری')}
        </h2>

        {journalEntry ? (
          <button
            type="button"
            onClick={() => onOpenJournalEntry?.(journalEntry.id)}
            disabled={!onOpenJournalEntry}
            className={cn(
              'flex w-full items-center justify-between gap-3 rounded-xl border border-[hsl(var(--border-default))] px-3 py-2 text-start',
              onOpenJournalEntry &&
                'transition-colors hover:border-[hsl(var(--color-primary)/0.5)] hover:bg-[hsl(var(--surface-muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))]',
            )}
          >
            <span className="min-w-0">
              <span className="block truncate text-sm text-[hsl(var(--fg-primary))]">
                {journalEntry.entryNumber ?? t('accounting.unnumberedEntry', 'سند بدون شماره')}
              </span>
              <span className="block truncate text-xs text-[hsl(var(--fg-tertiary))]">
                {journalEntry.date ? fmtDate(journalEntry.date) : '—'}
              </span>
            </span>
            <span className="shrink-0 text-xs text-[hsl(var(--color-primary))]">
              {t('common.view', 'مشاهده')}
            </span>
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-[hsl(var(--fg-tertiary))]">
              {t(
                'invoiceDetail.noJournalEntry',
                'این فاکتور هنوز در دفتر ثبت نشده است — یا در انتظار تأیید است، یا ثبت آن انجام نشده.',
              )}
            </p>
            {/* ⚠️ A WAY OUT, AND A REASON. Posting at creation could be
                skipped (no receivable/sales account in the chart) or fail,
                and both were silent — the invoice said «not in the ledger»
                with nothing anyone could do about it. */}
            {onPostToLedger ? (
              <button
                type="button"
                onClick={onPostToLedger}
                disabled={Boolean(isPostingToLedger)}
                className={cn(
                  'inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-medium',
                  'bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))]',
                  'hover:bg-[hsl(var(--color-primary)/0.2)] disabled:opacity-60',
                )}
              >
                <BookOpen className="size-3.5" aria-hidden="true" />
                {isPostingToLedger
                  ? t('invoiceDetail.postingToLedger', 'در حال ثبت در دفتر…')
                  : t('invoiceDetail.postToLedger', 'ثبت در دفتر')}
              </button>
            ) : null}
            {ledgerPostMessage ? (
              <p
                role="status"
                className="flex items-start gap-2 rounded-xl bg-[hsl(var(--color-warning)/0.12)] px-3 py-2 text-xs text-[hsl(var(--color-warning))]"
              >
                <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                <span>{ledgerPostMessage}</span>
              </p>
            ) : null}
          </div>
        )}
      </section>
    </div>
  )
}
