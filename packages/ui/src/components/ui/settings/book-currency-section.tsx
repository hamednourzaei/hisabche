// ============================================
// Settings → «ارز دفاتر»: the currency this business keeps its books in.
//
// One stored value on the server (GET/PUT /finance/currency/base). This panel
// shows it, and lets the owner choose it — while the books are still empty.
// After the first invoice or payment every amount in the ledger is in that
// currency; renaming it would relabel them all without converting one, so the
// server refuses and this panel says why instead of offering a dead control.
//
// ⚠️ Nothing here has a currency of its own: no default selection, no
// fallback label. Until the server has answered, the panel says it is loading.
// ============================================
'use client'

import { memo, useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Coins } from 'lucide-react'
import { apiErrorMessage, useBaseCurrency, useSetBaseCurrency } from '@hisabche/api'
import { CURRENCY_CODES } from '@hisabche/validation'

import { SelectField } from '../select-field'
import { useToast } from '../toast-provider'

const card =
  'rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]'

const KNOWN_REFUSALS = [
  'BASE_CURRENCY_LOCKED',
  'BASE_CURRENCY_FORBIDDEN',
  'BASE_CURRENCY_UNSUPPORTED',
  'BASE_CURRENCY_SCHEMA_REQUIRED',
] as const

export const BookCurrencySection = memo(function BookCurrencySection() {
  const t = useTranslations()
  const toast = useToast()
  const base = useBaseCurrency()
  const save = useSetBaseCurrency()
  const [chosen, setChosen] = useState<string | null>(null)

  const current = base.data?.currency
  const value = chosen ?? current ?? ''
  const mayChange = base.data?.changeable === true

  const handleSave = useCallback(async () => {
    if (!chosen || chosen === current) return
    try {
      await save.mutateAsync(chosen)
      setChosen(null)
      toast.success(t('settings.bookCurrency.saved'))
    } catch (error) {
      const message = apiErrorMessage(error, '')
      const known = KNOWN_REFUSALS.find((code) => message.includes(code))
      toast.error(known ? t(`settings.bookCurrency.${known}`) : t('settings.bookCurrency.failed'))
    }
  }, [chosen, current, save, t, toast])

  return (
    <section className={`${card} p-5`} aria-labelledby="book-currency-title">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-secondary))]">
          <Coins className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2
            id="book-currency-title"
            className="text-sm font-semibold text-[hsl(var(--fg-primary))]"
          >
            {t('settings.bookCurrency.title')}
          </h2>
          <p className="mt-1 text-xs text-[hsl(var(--fg-tertiary))]">
            {t('settings.bookCurrency.description')}
          </p>

          {base.isLoading ? (
            <p className="mt-4 text-sm text-[hsl(var(--fg-tertiary))]">
              {t('settings.bookCurrency.loading')}
            </p>
          ) : base.isError || !base.data ? (
            // A failed read is not «no currency»: say it could not be read.
            <p className="mt-4 text-sm text-[hsl(var(--color-destructive))]">
              {t('settings.bookCurrency.unreadable')}
            </p>
          ) : (
            <>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <SelectField
                  aria-label={t('settings.bookCurrency.title')}
                  name="currency"
                  className="w-40"
                  value={value}
                  onChange={setChosen}
                  disabled={!mayChange || save.isPending}
                  options={CURRENCY_CODES.map((code) => ({ value: code, label: code }))}
                />
                {mayChange ? (
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!chosen || chosen === current || save.isPending}
                    className="h-9 rounded-lg bg-[hsl(var(--color-primary))] px-4 text-sm font-medium text-[hsl(var(--color-primary-fg))] disabled:opacity-50"
                  >
                    {t('settings.bookCurrency.save')}
                  </button>
                ) : null}
              </div>
              {!mayChange ? (
                <p className="mt-3 text-xs text-[hsl(var(--fg-tertiary))]">
                  {base.data.configurable
                    ? t('settings.bookCurrency.BASE_CURRENCY_LOCKED')
                    : t('settings.bookCurrency.BASE_CURRENCY_SCHEMA_REQUIRED')}
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </section>
  )
})
