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

  const isBlocked = breach.isBlocked

  return (
    <div
      role="alert"
      className={`rounded-[var(--radius-md)] border p-3 ${
        isBlocked
          ? 'border-[hsl(var(--color-destructive)/0.5)] bg-[hsl(var(--color-destructive)/0.08)]'
          : 'border-[hsl(var(--color-warning)/0.5)] bg-[hsl(var(--color-warning)/0.08)]'
      }`}
    >
      <p
        className={`text-xs font-medium ${
          isBlocked ? 'text-[hsl(var(--color-destructive))]' : 'text-[hsl(var(--fg-primary))]'
        }`}
      >
        {isBlocked
          ? t('invoiceBuilder.creditLimitBlocked', 'فروش مسدود است: سقف اعتبار مشتری پر شده است')
          : t(
              'invoiceBuilder.creditLimitTitle',
              'این فروش بدهی مشتری را از سقف اعتبارش بیشتر می‌کند',
            )}
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
        {isBlocked
          ? t(
              'invoiceBuilder.creditLimitBlockedHint',
              'ثبت فاکتور تا زمان تسویه بدهی قبلی طبق تنظیمات کسب‌وکار مسدود است.',
            )
          : t(
              'invoiceBuilder.creditLimitHint',
              'ثبت انجام می‌شود؛ پیش از تحویل، دریافت یا تأیید را بررسی کنید.',
            )}
      </p>
    </div>
  )
}
