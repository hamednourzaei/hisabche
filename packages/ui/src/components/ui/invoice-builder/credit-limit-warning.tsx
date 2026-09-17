'use client'

// "This sale takes the customer past their credit limit." Informational —
// saving stays allowed (see use-customer-terms.ts).
import type { CreditBreach } from './use-customer-terms'

export function CreditLimitWarning({
  t,
  breach,
  formatMoney,
}: {
  t: (key: string, fallback?: string) => string
  breach: CreditBreach | null
  formatMoney: (value: number) => string
}) {
  if (!breach) return null
  return (
    <div
      role="alert"
      className="rounded-[var(--radius-md)] border border-[hsl(var(--color-warning)/0.5)] bg-[hsl(var(--color-warning)/0.08)] p-3"
    >
      <p className="text-xs font-medium text-[hsl(var(--fg-primary))]">
        {t('invoiceBuilder.creditLimitTitle', 'این فروش بدهی مشتری را از سقف اعتبارش بیشتر می‌کند')}
      </p>
      <dl className="mt-1.5 grid grid-cols-3 gap-2 text-xs text-[hsl(var(--fg-secondary))]">
        <div>
          <dt>{t('customerProfile.creditLimit', 'سقف اعتبار')}</dt>
          <dd className="tabular-nums text-[hsl(var(--fg-primary))]">
            {formatMoney(breach.creditLimit)}
          </dd>
        </div>
        <div>
          <dt>{t('customerProfile.creditUsed', 'استفاده‌شده')}</dt>
          <dd className="tabular-nums text-[hsl(var(--fg-primary))]">{formatMoney(breach.used)}</dd>
        </div>
        <div>
          <dt>{t('invoiceBuilder.creditAfter', 'بعد از این فاکتور')}</dt>
          <dd className="font-medium tabular-nums text-[hsl(var(--color-destructive))]">
            {formatMoney(breach.after)}
          </dd>
        </div>
      </dl>
      <p className="mt-1.5 text-xs text-[hsl(var(--fg-tertiary))]">
        {t(
          'invoiceBuilder.creditLimitHint',
          'ثبت انجام می‌شود؛ پیش از تحویل، دریافت یا تأیید را بررسی کنید.',
        )}
      </p>
    </div>
  )
}
