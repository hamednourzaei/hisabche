'use client'

// ============================================
// «پرداخت شد / پرداخت نشد» — the outcome of one salary, and the only place it
// is decided. Used by the payroll list and by the employee page.
//
// ⚠️ `PATCH /api/payrolls/:id` existed with no caller: a salary recorded as a
// draft had no way, on any screen, to become paid. The owner saw «پیش‌نویس»
// and no button.
//
// Three states, each saying what it means:
//   · waiting   — a green tick to confirm it, a red cross to say it was not paid
//   · paid      — a green tick and the day. Final: it is in the books
//                 (`isPayrollFinal`), so no button is offered.
//   · not paid  — a red cross and the reason, which the server requires. It can
//                 still be paid later.
//
// A recorded outcome is not a toggle: the buttons leave once it is final.
// ============================================

import { useState } from 'react'
import { CircleCheck, CircleX, Hourglass } from 'lucide-react'
import { apiErrorMessage, useSettlePayroll } from '@hisabche/api'
import { isPayrollFinal } from '@hisabche/validation'

import { ActionButton, ErrorNote } from '../capability/capability-kit'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../dialog'
import { JalaliDatePicker } from '../jalali-datepicker'
import { useDateFormat } from '../../../hooks/use-date-format'
import { cn } from '../../../lib/utils'

export interface PayrollOutcomeRow {
  id: string
  status?: string | null
  payment_date?: string | null
  notes?: string | null
}

type Asking = 'paid' | 'notPaid' | null

const REASON_MAX = 500

const ICON_BUTTON =
  'inline-flex size-8 items-center justify-center rounded-[var(--radius-md)] border transition-colors disabled:opacity-50'

/** Today, as the `YYYY-MM-DD` the date picker speaks. Local, not UTC. */
function todayIso(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function PayrollOutcome({
  t,
  row,
}: {
  t: (key: string, fallback?: string) => string
  row: PayrollOutcomeRow
}) {
  const settle = useSettlePayroll()
  const { date: fmtDay } = useDateFormat()
  const [asking, setAsking] = useState<Asking>(null)
  const [paidOn, setPaidOn] = useState('')
  const [reason, setReason] = useState('')
  const [failure, setFailure] = useState<string | null>(null)

  const status = row.status ?? 'draft'
  const isPaid = isPayrollFinal(status)
  const isNotPaid = status === 'cancelled'

  const open = (next: Exclude<Asking, null>) => {
    setFailure(null)
    setPaidOn(todayIso())
    setReason('')
    setAsking(next)
  }

  const save = async () => {
    setFailure(null)
    if (asking === 'notPaid' && reason.trim() === '') {
      setFailure(t('hr.outcome.reasonRequired', 'دلیل را بنویسید.'))
      return
    }
    try {
      if (asking === 'paid') {
        // The server's date is an instant; the picker gives a day.
        const day = new Date(`${paidOn || todayIso()}T00:00:00`)
        await settle.mutateAsync({ id: row.id, status: 'paid', paymentDate: day.toISOString() })
      } else {
        await settle.mutateAsync({ id: row.id, status: 'cancelled', notes: reason.trim() })
      }
      setAsking(null)
    } catch (err) {
      const message = apiErrorMessage(err, t('hr.outcome.failed', 'ذخیره نشد. دوباره تلاش کنید.'))
      // The server names its refusals; a code is not a sentence for a person.
      if (message.startsWith('PAYROLL_ALREADY_PAID')) {
        setFailure(
          t('hr.outcome.alreadyPaid', 'این حقوق قبلاً پرداخت‌شده ثبت شده و تغییر نمی‌کند.'),
        )
      } else if (message.startsWith('PAYROLL_REASON_REQUIRED')) {
        setFailure(t('hr.outcome.reasonRequired', 'دلیل را بنویسید.'))
      } else {
        setFailure(message)
      }
    }
  }

  return (
    // The row itself opens the employee; a click here is not that.
    <div
      className="flex items-center justify-end gap-2"
      data-payroll-outcome={status}
      onClick={(event) => event.stopPropagation()}
    >
      <span className="flex min-w-0 flex-col items-end text-xs">
        <span
          className={cn(
            'inline-flex items-center gap-1 font-medium',
            isPaid
              ? 'text-[hsl(var(--color-success))]'
              : isNotPaid
                ? 'text-[hsl(var(--color-destructive))]'
                : 'text-[hsl(var(--fg-secondary))]',
          )}
        >
          {isPaid ? (
            <CircleCheck className="size-4" aria-hidden="true" />
          ) : isNotPaid ? (
            <CircleX className="size-4" aria-hidden="true" />
          ) : (
            <Hourglass className="size-4" aria-hidden="true" />
          )}
          {isPaid
            ? t('hr.outcome.paid', 'پرداخت شد')
            : isNotPaid
              ? t('hr.outcome.notPaid', 'پرداخت نشد')
              : t('hr.outcome.waiting', 'در انتظار پرداخت')}
        </span>
        {isPaid && row.payment_date ? (
          <span className="tabular-nums text-[hsl(var(--fg-tertiary))]">
            {fmtDay(row.payment_date)}
          </span>
        ) : null}
        {isNotPaid && row.notes ? (
          <span className="max-w-[16rem] truncate text-[hsl(var(--fg-tertiary))]" title={row.notes}>
            {t('hr.outcome.because', 'دلیل')}: {row.notes}
          </span>
        ) : null}
      </span>

      {isPaid ? null : (
        <span className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className={cn(
              ICON_BUTTON,
              'border-[hsl(var(--color-success)/0.4)] text-[hsl(var(--color-success))] hover:bg-[hsl(var(--color-success)/0.12)]',
            )}
            aria-label={t('hr.outcome.markPaid', 'پرداخت شد')}
            title={t('hr.outcome.markPaid', 'پرداخت شد')}
            disabled={settle.isPending}
            onClick={() => open('paid')}
          >
            <CircleCheck className="size-4" aria-hidden="true" />
          </button>
          {isNotPaid ? null : (
            <button
              type="button"
              className={cn(
                ICON_BUTTON,
                'border-[hsl(var(--color-destructive)/0.4)] text-[hsl(var(--color-destructive))] hover:bg-[hsl(var(--color-destructive)/0.12)]',
              )}
              aria-label={t('hr.outcome.markNotPaid', 'پرداخت نشد')}
              title={t('hr.outcome.markNotPaid', 'پرداخت نشد')}
              disabled={settle.isPending}
              onClick={() => open('notPaid')}
            >
              <CircleX className="size-4" aria-hidden="true" />
            </button>
          )}
        </span>
      )}

      {asking ? (
        <Dialog open onOpenChange={(next) => !next && setAsking(null)}>
          <DialogContent className="sm:max-w-sm" data-payroll-outcome-dialog={asking}>
            <DialogHeader>
              <DialogTitle>
                {asking === 'paid'
                  ? t('hr.outcome.paidTitle', 'تأیید پرداخت حقوق')
                  : t('hr.outcome.notPaidTitle', 'این حقوق پرداخت نشد')}
              </DialogTitle>
            </DialogHeader>

            {asking === 'paid' ? (
              <div className="space-y-2">
                <JalaliDatePicker
                  value={paidOn}
                  onChange={setPaidOn}
                  placeholder={t('hr.paymentDate', 'تاریخ پرداخت')}
                />
                <p className="text-xs text-[hsl(var(--fg-secondary))]">
                  {t(
                    'hr.outcome.paidHint',
                    'بعد از تأیید، این پرداخت در دفتر حساب ثبت می‌شود و دیگر تغییر نمی‌کند.',
                  )}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <label
                  htmlFor={`payroll-reason-${row.id}`}
                  className="text-sm font-medium text-[hsl(var(--fg-primary))]"
                >
                  {t('hr.outcome.reason', 'چرا پرداخت نشد؟')}
                </label>
                <textarea
                  id={`payroll-reason-${row.id}`}
                  name="notes"
                  rows={3}
                  maxLength={REASON_MAX}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder={t(
                    'hr.outcome.reasonHint',
                    'مثلاً: کمبود نقدینگی، مرخصی بدون حقوق، اختلاف در مبلغ',
                  )}
                  className="w-full rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] p-2 text-sm text-[hsl(var(--fg-primary))] outline-none focus:border-[hsl(var(--color-primary))]"
                />
                <p className="text-xs text-[hsl(var(--fg-secondary))]">
                  {t(
                    'hr.outcome.notPaidHint',
                    'این حقوق بعداً هم می‌تواند با تیک سبز پرداخت‌شده ثبت شود.',
                  )}
                </p>
              </div>
            )}

            {failure ? <ErrorNote message={failure} /> : null}

            <DialogFooter className="gap-2">
              <ActionButton
                variant="quiet"
                onClick={() => setAsking(null)}
                disabled={settle.isPending}
              >
                {t('common.cancel', 'انصراف')}
              </ActionButton>
              <ActionButton
                variant={asking === 'paid' ? 'primary' : 'danger'}
                onClick={() => void save()}
                disabled={settle.isPending}
              >
                {asking === 'paid'
                  ? t('hr.outcome.confirmPaid', 'تأیید پرداخت')
                  : t('hr.outcome.confirmNotPaid', 'ثبت پرداخت‌نشدن')}
              </ActionButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  )
}
