'use client'

// ============================================
// packages/ui/src/components/ui/invoice-detail/invoice-evidence-panel.tsx
//
// «Why this profit?» — for one invoice, the chain behind the figure:
// sales → shared discount → net sales → each cost and the purchase it came
// from → profit, with the journal entry and the payments beside it.
//
// Loads only when asked (the chain reads every cost layer behind the sale).
// A 403 is its own sentence: the figure is for people who see profit.
// ============================================

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Scale } from 'lucide-react'
import { apiErrorMessage, useInvoiceEvidence } from '@hisabche/api'

import { formatSelectedAmount } from '../../../lib/money-display'
import { evidenceSourceLabel } from '../../../lib/evidence-labels'
import { Button } from '../button'

export function InvoiceEvidencePanel({ invoiceId }: { invoiceId: string }) {
  const tOriginal = useTranslations()
  const t = (key: string, fallback?: string): string => {
    const v = tOriginal(key as Parameters<typeof tOriginal>[0])
    return v && v !== key ? v : (fallback ?? key)
  }
  const [open, setOpen] = useState(false)
  const evidence = useInvoiceEvidence(invoiceId, open)
  const status = (evidence.error as { response?: { status?: number } } | null)?.response?.status
  const money = (value: number) => formatSelectedAmount(value)

  return (
    <section className="space-y-3 rounded-2xl border border-[hsl(var(--border-default))] p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold text-[hsl(var(--fg-primary))]">
          <Scale className="size-4 text-[hsl(var(--color-primary))]" aria-hidden="true" />
          {t('evidence.invoiceTitle')}
        </h3>
        <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}>
          {open ? t('evidence.hide') : t('evidence.show')}
        </Button>
      </div>

      {open && evidence.isLoading && (
        <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('evidence.loading')}</p>
      )}
      {open && status === 403 && (
        <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('evidence.forbidden')}</p>
      )}
      {open && evidence.error && status !== 403 && (
        <p className="text-sm text-[hsl(var(--color-destructive))]">
          {apiErrorMessage(evidence.error, t('evidence.loadError'))}
        </p>
      )}

      {open && evidence.data && (
        <div className="space-y-3 text-sm">
          <dl className="space-y-1">
            {(
              [
                ['evidence.grossSales', evidence.data.grossSales],
                ['evidence.discount', -evidence.data.discount],
                ['evidence.netSales', evidence.data.netSales],
                ['evidence.cost', -evidence.data.cost],
                ['evidence.grossProfit', evidence.data.grossProfit],
              ] as const
            ).map(([key, value]) => (
              <div key={key} className="flex justify-between gap-2">
                <dt className="text-[hsl(var(--fg-secondary))]">{t(key)}</dt>
                <dd className="tabular-nums" dir="ltr">
                  {money(value)} {evidence.data.currency}
                </dd>
              </div>
            ))}
            {evidence.data.marginPercent !== null && (
              <div className="flex justify-between gap-2">
                <dt className="text-[hsl(var(--fg-secondary))]">{t('evidence.margin')}</dt>
                <dd dir="ltr">{evidence.data.marginPercent}%</dd>
              </div>
            )}
          </dl>

          {evidence.data.warnings.map((w) => (
            <p
              key={w}
              className="rounded-lg bg-[hsl(var(--color-warning)/0.12)] px-3 py-2 text-xs text-[hsl(var(--color-warning))]"
            >
              {t(`evidence.warning.${w}`)}
            </p>
          ))}

          <ul className="space-y-2">
            {evidence.data.lines.map((line, i) => (
              <li
                key={`${line.productId ?? line.name}-${i}`}
                className="rounded-xl bg-[hsl(var(--surface-muted))] p-3"
              >
                <p className="flex justify-between gap-2 font-medium">
                  <span>
                    {line.name} <span dir="ltr">× {line.quantity}</span>
                  </span>
                  <span className="tabular-nums" dir="ltr">
                    {money(line.profit)}
                  </span>
                </p>
                <p className="text-xs text-[hsl(var(--fg-tertiary))]">
                  {t('evidence.netSales')}: <span dir="ltr">{money(line.netRevenue)}</span> ·{' '}
                  {t('evidence.cost')}: <span dir="ltr">{money(line.cost)}</span>
                </p>
                {line.sources.map((src, j) => (
                  <p key={j} className="text-xs text-[hsl(var(--fg-secondary))]">
                    <span dir="ltr">
                      {src.quantity} × {money(src.unitCost)}
                    </span>{' '}
                    ←{' '}
                    {src.layer
                      ? `${evidenceSourceLabel(t, src.layer.sourceType)} (${src.layer.entryDate})`
                      : t('evidence.estimatedSource')}
                  </p>
                ))}
              </li>
            ))}
          </ul>

          <p className="text-xs text-[hsl(var(--fg-secondary))]">
            {evidence.data.ledger.length > 0
              ? `${t('evidence.ledger')}: ${evidence.data.ledger.map((j) => j.entryNumber ?? j.id.slice(0, 8)).join('، ')}`
              : t('evidence.noLedger')}
            {' · '}
            {t('evidence.paid')}: <span dir="ltr">{money(evidence.data.paidTotal)}</span>
          </p>
        </div>
      )}
    </section>
  )
}
