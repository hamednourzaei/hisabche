// packages/ui/src/components/ui/onboarding/currency-picker.tsx
'use client'

// ============================================
// The currency picker — ONE control, two screens.
//
// It was the body of the onboarding wizard's currency step. The offline
// first run needs the same question («which unit do you price in?») and the
// same answer, so the control was lifted out of the step and both screens
// use it. A second picker would be a second list of currencies, a second
// place to forget that a code is not supported, and a second way for the
// books currency to differ from what the person chose.
//
// ⚠️ NOTHING IS PRE-CHOSEN.
//
// `value` is null until the person picks. A books currency that is
// preselected is a books currency nobody chose, and the offline edition
// refuses to create a workspace without one.
// ============================================

import { memo, useMemo } from 'react'
import { CURRENCIES, primaryCurrencies } from '@hisabche/ui-contract'
import { isSupportedCurrency } from '@hisabche/store'
import { useCurrencies, type CurrencyRecord } from '@hisabche/api'

import { cn } from '../../../lib/utils'
import { SearchableOptionList } from './searchable-option-list'

const selectedClasses =
  'border-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary)/0.08)] shadow-[0_0_0_2px_hsl(var(--color-primary)/0.3)]'
const unselectedClasses =
  'border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] hover:border-[hsl(var(--color-primary)/0.4)]'

export interface CurrencyPickerProps {
  /** The chosen code, or null when nothing has been chosen yet. */
  value: string | null
  onChange: (code: string) => void
  /** Interface language — decides which two currencies are offered as cards. */
  lang: string
  t: (key: string, fallback?: string) => string
}

export const CurrencyPicker = memo(function CurrencyPicker({
  value,
  onChange,
  lang,
  t,
}: CurrencyPickerProps) {
  // Two cards, chosen by interface language: toman-first for Persian,
  // afghani-first for Dari, dollar second in both. Everything else — including
  // precious metals, which are priced by weight — is found by searching.
  //
  // Only the codes the product can actually honour are offered.
  //
  // ⚠️ THE COMMENT HERE USED TO SAY «accepts four». That was true before T1
  // and is not now — `currencyCodeSchema` accepts 25, including the metals.
  // The defect it described was real and is worth keeping in view: the
  // catalogue offered codes the schema rejected, the answer was cast through
  // `as`, and every formatter then quietly replaced it with AFN. A shopkeeper
  // who picked تومان was shown افغانی for the life of the account.
  //
  // ⚠️ THE LIST IS INTERSECTED WITH `isSupportedCurrency`, NOT TAKEN FROM THE
  // SERVER WHOLESALE (Patch 1).
  //
  // `currencies.is_active` and `CURRENCY_CODES` are meant to be the same 25,
  // and a verification query checks it. But if someone activates a row in the
  // database WITHOUT adding its precision to `FRACTION_DIGITS`, the server
  // would start offering a code this build cannot format — amounts with no
  // precision contract, which is a wrong number rather than a missing option
  // (rule 9). Intersecting means the database can never widen the picker past
  // what the code can honour; it can only ever narrow it.
  //
  // What the server DOES contribute is the reference data itself: the name,
  // the Persian name and the symbol, which is exactly what a reference table
  // is for. On a device there is no server, so the catalogue below is the
  // whole answer.
  const { data: currencyData } = useCurrencies()

  const serverCurrencies = useMemo(() => {
    const rows = currencyData?.currencies ?? []
    return new Map<string, CurrencyRecord>(rows.map((row) => [row.code, row]))
  }, [currencyData])

  const primary = useMemo(
    () => primaryCurrencies(lang).filter((c) => isSupportedCurrency(c.code)),
    [lang],
  )
  const primaryCodes = useMemo(() => new Set(primary.map((c) => c.code)), [primary])

  const searchable = useMemo(
    () =>
      CURRENCIES.filter((c) => isSupportedCurrency(c.code) && !primaryCodes.has(c.code)).map(
        (c) => {
          // The server's name wins when it has one — it is the reference
          // table. The catalogue's label is the fallback, so a database that
          // has not run the migration still renders proper names.
          // ⚠️ The bundle is the only source that speaks all three interface
          // languages; the reference table carries ONE Persian name and one
          // English name, so `nameFa` cannot serve an `en` or an `af` reader.
          // It used to win outright (`label: fromTable?.nameFa ?? t(...)`), and
          // the English onboarding listed «🇦🇫 افغانی · 🇮🇷 ریال ایران · 🇵🇰
          // روپیه پاکستان» inside an English step. The table is now only the
          // fallback for a key the bundle does not have.
          const fromTable = serverCurrencies.get(c.code)
          const serverFallback =
            lang === 'en' ? (fromTable?.name ?? c.labelFa) : (fromTable?.nameFa ?? c.labelFa)
          return {
            id: c.code,
            label: t(c.labelKey, serverFallback),
            prefix: c.flag,
          }
        },
      ),
    [primaryCodes, t, serverCurrencies],
  )

  const selected = useMemo(() => new Set(value ? [value] : []), [value])

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {primary.map((cur) => (
          <button
            key={cur.code}
            type="button"
            onClick={() => onChange(cur.code)}
            className={cn(
              'rounded-2xl border-2 p-3.5 transition-all duration-200 sm:p-5',
              'motion-reduce:transition-none',
              value === cur.code ? selectedClasses : unselectedClasses,
            )}
          >
            <div className="mb-1.5 text-2xl sm:mb-2 sm:text-3xl">{cur.flag}</div>
            <div className="text-sm font-medium text-[hsl(var(--fg-primary))] sm:text-base">
              {t(cur.labelKey, cur.labelFa)}
            </div>
          </button>
        ))}
      </div>

      {/* Only reached if neither card is the user's unit. Same control as the
          business-type step, so the interaction is learned once. */}
      <div className="mt-4">
        <SearchableOptionList
          options={searchable}
          selected={selected}
          onToggle={onChange}
          placeholder={t('onboarding.searchCurrency', 'واحد پولت را جست‌وجو کن')}
          emptyLabel={t('onboarding.noCurrencyMatch', 'موردی پیدا نشد')}
        />
      </div>
    </div>
  )
})
CurrencyPicker.displayName = 'CurrencyPicker'
