'use client'

// ============================================
// Stock on the shelf with no cost behind it — said where the profit is read.
//
// A product entered with a quantity before opening stock wrote its cost layer
// has units and no cost: every sale of them is booked with no cost of goods,
// and the profit of that sale is not known (INV-000077, 11 Oct 2026).
//
// This notice shows only when such stock exists. Valuing it is an ACT — it
// changes what later sales are reported to have cost — so it takes a second,
// confirming press, and only owners and managers are allowed by the server.
// Products with no purchase price are named as blocked; nothing is valued at
// zero.
// ============================================

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { formatNumber } from '@hisabche/formatting'
import { apiErrorMessage, useUnvaluedStock, useValueUnvaluedStock } from '@hisabche/api'

import { Button } from '../../button'

export function UnvaluedStockNotice({ currency }: { currency: string }) {
  const t = useTranslations('accounting.unvalued')
  const locale = useLocale()
  const stock = useUnvaluedStock()
  const value = useValueUnvaluedStock()
  const [confirming, setConfirming] = useState(false)

  const data = stock.data
  // Nothing to say: no such stock, still loading, or not allowed to see costs.
  if (!data || data.rows.length === 0) return null

  const number = (amount: number, digits = 2) => formatNumber(amount, locale, digits)

  return (
    <section
      role="status"
      className="space-y-2 rounded-xl border border-[hsl(var(--color-warning)/0.4)] bg-[hsl(var(--color-warning)/0.08)] p-4 text-sm"
    >
      <h3 className="font-semibold text-[hsl(var(--fg-primary))]">{t('title')}</h3>

      {data.ready.products > 0 ? (
        <p className="text-[hsl(var(--fg-secondary))]">
          {t('ready', {
            products: number(data.ready.products, 0),
            quantity: number(data.ready.quantity, 3),
          })}{' '}
          {t('value', { value: number(data.ready.value), currency })}
        </p>
      ) : null}
      {data.blocked.products > 0 ? (
        <p className="text-[hsl(var(--fg-secondary))]">
          {t('blocked', {
            products: number(data.blocked.products, 0),
            quantity: number(data.blocked.quantity, 3),
          })}
        </p>
      ) : null}

      {data.ready.products > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {confirming ? (
            <>
              <span className="text-xs text-[hsl(var(--fg-secondary))]">{t('confirm')}</span>
              <Button
                size="sm"
                disabled={value.isPending}
                onClick={() => value.mutate(undefined, { onSettled: () => setConfirming(false) })}
              >
                {value.isPending ? t('working') : t('confirmAction')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                {t('cancel')}
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setConfirming(true)}>
              {t('action')}
            </Button>
          )}
        </div>
      ) : null}

      {value.isSuccess ? (
        <p className="text-xs text-[hsl(var(--color-success))]">
          {t('done', { valued: number(value.data.valued, 0) })}
        </p>
      ) : null}
      {value.isError ? (
        <p role="alert" className="text-xs text-[hsl(var(--color-destructive))]">
          {apiErrorMessage(value.error, t('failed'))}
        </p>
      ) : null}
    </section>
  )
}
