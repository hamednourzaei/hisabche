'use client'

// ============================================
// packages/ui/src/components/ui/invoices/credit-status-badge.tsx
//
// V53 OD-3 — a sale the SERVER has not approved yet must not look like a final one.
//
// The device cannot answer «may this customer take more credit?»: it does not know the limit or what they
// already owe. So a sale made offline is written locally, sent, and only then does the server say yes or no.
// Until it says yes the sale is NOT revenue (the local dashboard leaves it out) and this marker says so, in
// the invoice list and on the mobile card, right beside the ordinary status.
//
//   pending_validation  waiting for someone who holds `credit.override` to approve it with a reason
//   rejected            refused again after that attempt — edit it or cancel it
//   validated / null    nothing to warn about: an accepted sale (null = the question was never asked)
// ============================================

import { cn } from '../../../lib/utils'

/** The three states the server can answer with; anything else is treated as «no marker». */
export type CreditStatus = 'pending_validation' | 'validated' | 'rejected'

const TONES: Record<'pending_validation' | 'rejected', string> = {
  pending_validation:
    'bg-[hsl(var(--color-warning)/0.12)] text-[hsl(var(--color-warning))] border-[hsl(var(--color-warning)/0.25)]',
  rejected:
    'bg-[hsl(var(--color-destructive)/0.12)] text-[hsl(var(--color-destructive))] border-[hsl(var(--color-destructive)/0.25)]',
}

export interface CreditStatusBadgeProps {
  /** `null`/absent = no credit question was asked; `validated` needs no marker either. */
  status: string | null | undefined
  t: (key: string, fallback?: string) => string
  className?: string
}

export function CreditStatusBadge({ status, t, className }: CreditStatusBadgeProps) {
  if (status !== 'pending_validation' && status !== 'rejected') return null

  const pending = status === 'pending_validation'
  const label = pending
    ? t('invoices.creditPending', 'در انتظار تأیید اعتبار')
    : t('invoices.creditRejected', 'اعتبار رد شد')
  const hint = pending
    ? t(
        'invoices.creditPendingHint',
        'این فروش هنوز قطعی نیست: سرور باید اعتبار مشتری را تأیید کند. تا آن زمان در درآمد شمرده نمی‌شود.',
      )
    : t(
        'invoices.creditRejectedHint',
        'سرور این فروش را از نظر اعتبار نپذیرفت. آن را اصلاح یا لغو کنید.',
      )

  return (
    <span
      role="status"
      data-credit-status={status}
      title={hint}
      aria-label={label}
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold',
        TONES[status],
        className,
      )}
    >
      {label}
    </span>
  )
}
