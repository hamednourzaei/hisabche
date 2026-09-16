'use client'

// "This sale takes stock below zero" — shown on the invoice form while the
// quantity is typed, and again on the preview before saving. Informational:
// saving is still allowed (see use-oversold-lines.ts).
import type { OversoldLine } from './use-oversold-lines'

export function OversoldWarning({
  t,
  lines,
}: {
  t: (key: string, fallback?: string) => string
  lines: readonly OversoldLine[]
}) {
  if (lines.length === 0) return null
  return (
    <div
      role="alert"
      className="rounded-[var(--radius-md)] border border-[hsl(var(--color-destructive)/0.4)] bg-[hsl(var(--color-destructive)/0.06)] p-3"
    >
      <p className="text-xs font-medium text-[hsl(var(--color-destructive))]">
        {t('invoiceBuilder.oversoldTitle', 'موجودی این کالاها با این فاکتور منفی می‌شود')}
      </p>
      <ul className="mt-1.5 flex flex-col gap-0.5 text-xs text-[hsl(var(--fg-secondary))]">
        {lines.map((line) => (
          <li key={line.productId} className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate">{line.name}</span>
            <span className="shrink-0 tabular-nums" dir="ltr">
              {line.onHand} → {line.after}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-xs text-[hsl(var(--fg-tertiary))]">
        {t(
          'invoiceBuilder.oversoldHint',
          'ثبت انجام می‌شود، اما موجودی انبار منفی خواهد شد. اگر خرید ثبت نشده، ابتدا آن را ثبت کنید.',
        )}
      </p>
    </div>
  )
}
