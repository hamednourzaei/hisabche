'use client'

// ============================================
// The server refused a sale because it takes the customer past their credit limit (V53 OD-3).
//
// Passing the limit is a decision of someone who holds `credit.override`, with a reason that is kept in
// the invoice's history. The screen does not know who may — the server decides — so the reason is asked
// here and sent with the same request; a refusal for lack of permission is shown as such.
// Nothing is shown as saved until the server says it was.
// ============================================

import { Textarea } from '../textarea'

/** Shortest reason the server accepts (credit-limit check in invoice.service.ts). */
export const CREDIT_OVERRIDE_MIN_REASON = 3

export type CreditStop = {
  /** `CREDIT_LIMIT_EXCEEDED` or `CASH_ONLY_CUSTOMER`, as the server named it. */
  code: 'CREDIT_LIMIT_EXCEEDED' | 'CASH_ONLY_CUSTOMER'
  /** Amount over the limit, in the invoice's books currency, when the server said it. */
  overBy: string | null
}

/** Reads the server's refusal; null when the failure is about something else. */
export function creditStopFrom(message: string): CreditStop | null {
  const code = /CASH_ONLY_CUSTOMER/.test(message)
    ? 'CASH_ONLY_CUSTOMER'
    : /CREDIT_LIMIT_EXCEEDED/.test(message)
      ? 'CREDIT_LIMIT_EXCEEDED'
      : null
  if (!code) return null
  return { code, overBy: /over by ([0-9.]+)/.exec(message)?.[1] ?? null }
}

export function isCreditOverrideForbidden(message: string): boolean {
  return /CREDIT_OVERRIDE_FORBIDDEN/.test(message)
}

export function CreditOverridePanel({
  t,
  stop,
  reason,
  onReasonChange,
  forbidden,
  disabled,
}: {
  t: (key: string, fallback?: string) => string
  stop: CreditStop
  reason: string
  onReasonChange: (value: string) => void
  /** The last attempt with a reason was refused for lack of the permission. */
  forbidden: boolean
  disabled: boolean
}) {
  const tooShort = reason.trim().length < CREDIT_OVERRIDE_MIN_REASON
  return (
    <div
      role="alert"
      className="rounded-[var(--radius-md)] border border-[hsl(var(--color-destructive)/0.5)] bg-[hsl(var(--color-destructive)/0.08)] p-3"
    >
      <p className="text-xs font-medium text-[hsl(var(--color-destructive))]">
        {stop.code === 'CASH_ONLY_CUSTOMER'
          ? t('invoiceBuilder.creditOverride.cashOnly', 'این مشتری فقط نقدی خرید می‌کند.')
          : t('invoiceBuilder.creditOverride.title', 'این فروش از سقف اعتبار مشتری فراتر می‌رود.')}
        {stop.overBy ? (
          <span dir="ltr" className="ms-1 tabular-nums">
            {stop.overBy}
          </span>
        ) : null}
      </p>
      <p className="mt-1 text-xs text-[hsl(var(--fg-secondary))]">
        {t(
          'invoiceBuilder.creditOverride.hint',
          'عبور از سقف فقط با مجوز «عبور از سقف اعتبار» و ذکر دلیل ممکن است؛ دلیل در تاریخچه‌ی فاکتور ثبت می‌شود.',
        )}
      </p>
      <label className="mt-2 block text-xs text-[hsl(var(--fg-secondary))]">
        {t('invoiceBuilder.creditOverride.reasonLabel', 'دلیل عبور از سقف')}
        <Textarea
          name="creditOverrideReason"
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
          rows={2}
          disabled={disabled}
          className="mt-1"
        />
      </label>
      {forbidden ? (
        <p className="mt-1.5 text-xs font-medium text-[hsl(var(--color-destructive))]">
          {t(
            'invoiceBuilder.creditOverride.forbidden',
            'شما مجوز عبور از سقف اعتبار را ندارید. تأیید یک مدیر لازم است.',
          )}
        </p>
      ) : null}
      {tooShort ? (
        <p className="mt-1.5 text-[11px] text-[hsl(var(--fg-tertiary))]">
          {t('invoiceBuilder.creditOverride.reasonRequired', 'برای ثبت دوباره، دلیل را بنویسید.')}
        </p>
      ) : null}
    </div>
  )
}
