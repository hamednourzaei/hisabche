'use client'

// ============================================
// The server refused a sale because it takes the customer past their credit limit (V53 OD-3).
//
// Passing the limit is a decision of someone who holds `credit.override`, with a reason that is kept in
// the invoice's history. The screen does not know who may — the server decides — so the reason is asked
// here and sent with the same request; a refusal for lack of permission is shown as such.
// Nothing is shown as saved until the server says it was.
// ============================================

import { formatNumber } from '@hisabche/formatting'

import { Textarea } from '../textarea'

/** Shortest reason the server accepts (credit-limit check in invoice.service.ts). */
export const CREDIT_OVERRIDE_MIN_REASON = 3

export type CreditStop = {
  /** `CREDIT_LIMIT_EXCEEDED` or `CASH_ONLY_CUSTOMER`, as the server named it. */
  code: 'CREDIT_LIMIT_EXCEEDED' | 'CASH_ONLY_CUSTOMER'
  /** Amount over the limit, in the invoice's books currency, when the server said it. */
  overBy: string | null
  /**
   * The structured facts the server sends beside the sentence (V53 Phase C). Present only when the
   * server included them; a screen must never invent a limit to fill the gap.
   */
  currency?: string | undefined
  limit?: number | undefined
  exposure?: number | undefined
  projected?: number | undefined
}

type RefusalContext = {
  currency?: string | undefined
  limit?: number | undefined
  exposure?: number | undefined
  excess?: number | undefined
  projected?: number | undefined
}

/** Reads `context` from a rejected request; null when there is none (an older server, or another error). */
function refusalContextOf(input: unknown): RefusalContext | null {
  if (typeof input !== 'object' || input === null) return null
  const record = input as { context?: unknown; response?: { data?: { context?: unknown } } }
  const raw = record.response?.data?.context ?? record.context
  if (typeof raw !== 'object' || raw === null) return null
  const facts = raw as Record<string, unknown>
  const amount = (key: string): number | undefined => {
    const value = facts[key]
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined
  }
  const currency =
    typeof facts.currency === 'string' && facts.currency.length > 0 ? facts.currency : null
  return {
    ...(currency ? { currency } : {}),
    ...(amount('limit') !== undefined ? { limit: amount('limit') } : {}),
    ...(amount('exposure') !== undefined ? { exposure: amount('exposure') } : {}),
    ...(amount('excess') !== undefined ? { excess: amount('excess') } : {}),
    ...(amount('projected') !== undefined ? { projected: amount('projected') } : {}),
  }
}

/**
 * Reads the server's refusal; null when the failure is about something else.
 *
 * Accepts the rejected request (preferred: it also carries the structured numbers) or, as before, the
 * plain message — so an older backend, an offline log line or a test still reads the same refusal.
 */
export function creditStopFrom(input: unknown): CreditStop | null {
  const message =
    typeof input === 'string'
      ? input
      : typeof (input as { message?: unknown } | null)?.message === 'string'
        ? (input as { message: string }).message
        : ''
  const code = /CASH_ONLY_CUSTOMER/.test(message)
    ? 'CASH_ONLY_CUSTOMER'
    : /CREDIT_LIMIT_EXCEEDED/.test(message)
      ? 'CREDIT_LIMIT_EXCEEDED'
      : null
  if (!code) return null
  const context = refusalContextOf(input)
  const overBy =
    context?.excess !== undefined
      ? String(context.excess)
      : (/over by ([0-9.]+)/.exec(message)?.[1] ?? null)
  return {
    code,
    overBy,
    ...(context?.currency ? { currency: context.currency } : {}),
    ...(context?.limit !== undefined ? { limit: context.limit } : {}),
    ...(context?.exposure !== undefined ? { exposure: context.exposure } : {}),
    ...(context?.projected !== undefined ? { projected: context.projected } : {}),
  }
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
  locale,
}: {
  t: (key: string, fallback?: string) => string
  stop: CreditStop
  reason: string
  onReasonChange: (value: string) => void
  /** The last attempt with a reason was refused for lack of the permission. */
  forbidden: boolean
  disabled: boolean
  /** Digits for the amounts the server sent; defaults to Latin digits when the screen has no locale. */
  locale?: string | undefined
}) {
  const tooShort = reason.trim().length < CREDIT_OVERRIDE_MIN_REASON
  const digits = locale ?? 'en-US'
  const money = (value: number): string =>
    `${formatNumber(value, digits, 2)} ${stop.currency ?? ''}`.trim()
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
      {stop.limit !== undefined || stop.exposure !== undefined ? (
        <dl className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-[hsl(var(--fg-secondary))]">
          {stop.limit !== undefined ? (
            <div className="flex gap-1">
              <dt>{t('invoiceBuilder.creditOverride.limit', 'سقف اعتبار')}</dt>
              <dd dir="ltr" className="tabular-nums">
                {money(stop.limit)}
              </dd>
            </div>
          ) : null}
          {stop.exposure !== undefined ? (
            <div className="flex gap-1">
              <dt>{t('invoiceBuilder.creditOverride.exposure', 'بدهی فعلی')}</dt>
              <dd dir="ltr" className="tabular-nums">
                {money(stop.exposure)}
              </dd>
            </div>
          ) : null}
          {stop.projected !== undefined ? (
            <div className="flex gap-1">
              <dt>{t('invoiceBuilder.creditOverride.projected', 'پس از این فروش')}</dt>
              <dd dir="ltr" className="tabular-nums">
                {money(stop.projected)}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}
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
