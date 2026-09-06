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
}: InvoiceRelatedPanelProps) {
  if (isLoading) {
    return <div className={cn(card, 'h-40 animate-pulse bg-[hsl(var(--surface-muted))]')} />
  }

  // Compared in minor units. A float comparison on money reports a difference
  // of 0.0000001 as drift and hides a real one of half a cent (lesson 9).
  const drifted = Math.round(allocatedTotal * 100) !== Math.round(storedPaidAmount * 100)

  return (
    <div className="space-y-4">
      {/* ─── Payments ─────────────────────────────────────────────────── */}
      <section className={card}>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[hsl(var(--fg-primary))]">
          <Receipt className="size-4 text-[hsl(var(--color-primary))]" aria-hidden="true" />
          {t('invoiceDetail.payments', 'پرداخت‌های این فاکتور')}
        </h2>

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

        {drifted ? (
          // Phase F made `paid_amount` a projection of these rows. If the two
          // disagree the trigger did not run — silence here would leave a
          // receivables report that quietly contradicts the payments.
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-[hsl(var(--status-warning)/0.12)] px-3 py-2 text-xs text-[hsl(var(--status-warning))]">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>
              {t(
                'invoiceDetail.paidAmountDrift',
                'مبلغ پرداخت‌شده‌ی ثبت‌شده روی فاکتور با مجموع پرداخت‌ها یکی نیست',
              )}
              {': '}
              <span className="tabular-nums">{fmtMoney(storedPaidAmount)}</span>
            </span>
          </p>
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
          <p className="text-sm text-[hsl(var(--fg-tertiary))]">
            {t(
              'invoiceDetail.noJournalEntry',
              'این فاکتور هنوز در دفتر ثبت نشده است — یا در انتظار تأیید است، یا ثبت آن انجام نشده.',
            )}
          </p>
        )}
      </section>
    </div>
  )
}
