'use client'

// ============================================
// Capability #81 — «what will this do, and can it be undone?», shown in the
// confirmation of an action that moves money or stock, BEFORE the button.
//
// The answer comes from the server (`GET /compensation`), which is the one
// place that knows what each command's undo is. This component turns it into a
// sentence in the reader's language.
//
// ⚠️ NO ANSWER IS AN ANSWER. While it loads, when it fails, and when the server
// does not know the command, the component says the effect could not be
// confirmed — it never renders nothing, because «no warning» reads as «safe».
// ============================================

import { useCompensationPlan, type CompensationKind } from '@hisabche/api'

type T = (key: string, fallback?: string) => string

/** Every command the server can describe, each with a sentence in the catalogue. */
export const UNDO_KINDS: readonly CompensationKind[] = [
  'invoice_create',
  'invoice_cancel',
  'payment_record',
  'payment_cancel',
  'purchase_order_create',
  'stock_adjust',
  'budget_commit',
]
const KNOWN: ReadonlySet<string> = new Set(UNDO_KINDS)

export function UndoDisclosure({ t, route }: { t: T; route: string }) {
  const answer = useCompensationPlan(route)
  const plan = answer.data?.plan ?? null

  const box =
    'rounded-[var(--radius-md)] border border-[hsl(var(--color-warning)/0.4)] bg-[hsl(var(--color-warning)/0.08)] p-3 text-xs text-[hsl(var(--fg-primary))]'

  if (answer.isLoading) {
    return (
      <div className="h-12 animate-pulse rounded-[var(--radius-md)] bg-[hsl(var(--surface-muted))]" />
    )
  }

  if (answer.error || !plan || !KNOWN.has(plan.kind)) {
    return (
      <p role="note" className={box}>
        {t(
          'undo.unknown',
          'نتوانستیم تأیید کنیم این کار دقیقاً چه چیزهایی را تغییر می‌دهد. با احتیاط ادامه دهید.',
        )}
      </p>
    )
  }

  return (
    <div role="note" className={box}>
      <p>{t(`undo.kind.${plan.kind}`, plan.kind)}</p>
      <ul className="mt-1.5 list-disc space-y-0.5 ps-4 text-[hsl(var(--fg-secondary))]">
        {plan.touchesBooks ? (
          <li>{t('undo.touchesBooks', 'در دفتر، سند برگشت ثبت می‌شود؛ سند اول پاک نمی‌شود.')}</li>
        ) : null}
        <li>
          {plan.strategy === 'none' || plan.needsHuman
            ? t('undo.irreversible', 'این کار بعداً قابل بازگرداندن نیست.')
            : t('undo.reversible', 'اگر اشتباه بود، با یک ثبت تازه قابل جبران است.')}
        </li>
      </ul>
    </div>
  )
}
