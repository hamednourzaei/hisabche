'use client'

// ============================================
// packages/ui/src/hooks/dashboard/use-display-basis.ts
//
// T10 — «بر چه مبنایی ببینم».
//
// ---------------------------------------------------------------------------
// WHAT THIS IS
//
// One place that answers: given an amount recorded in the workspace's own
// currency, what should the screen show — that amount, or its equivalent in
// some other currency the shop keeps a rate for?
//
// The owner's example was gold: a jeweller wants «فروش کل» as grams rather
// than as afghanis. They then clarified that gold is only an example and any
// currency should work, which is what this does — XAU is not special here, it
// is a currency code with a rate like any other.
//
// ---------------------------------------------------------------------------
// ⚠️ THIS IS DISPLAY. IT IS NOT THE ACCOUNTING BASIS, AND THE DIFFERENCE IS
// NOT A TECHNICALITY.
//
// The task asked that «منطق حسابداری هم باید همین را رعایت کند». It must not,
// in this form, and the reason matters:
//
//   · A ledger entry is denominated in the currency the transaction happened
//     in. That is not a display preference — it is what the customer paid.
//   · Re-expressing posted balances by whatever rate is current TODAY would
//     make every historical figure move whenever the gold price moves, and
//     last month's closed books would report a different profit each morning.
//   · The accounting operation that legitimately does this already exists and
//     is separate: `POST /currency/revalue`, which values foreign balances at
//     a stated rate and BOOKS the difference as a real journal entry. That is
//     revaluation, it is auditable, and it is not a toggle.
//
// So this converts what is on screen and nothing else. The stored amount, the
// journal entry and the invoice are untouched.
//
// ---------------------------------------------------------------------------
// ⚠️ NO RATE MEANS NO NUMBER
//
// `convertVia` returns null when either leg is unknown, and this passes that
// straight through as `available: false`. Nothing falls back to the
// unconverted amount, because an unconverted amount relabelled in another
// currency is a wrong figure that looks exactly like a right one.
// ============================================

import { useCallback, useMemo } from 'react'

import { convertVia, useExchangeRates } from '@hisabche/api'
import { isSupportedCurrency, useCurrencyStore, type CurrencyCode } from '@hisabche/store'

/** What a converted amount came out as, or why it did not. */
export interface DisplayAmount {
  /** The number to render, in `currency`. Null when no rate is available. */
  value: number | null
  /** The code the value is expressed in — the basis when converted, else the source. */
  currency: string
  /** False when a rate was missing. The UI must say so rather than show a figure. */
  available: boolean
  /** True when the basis differs from the amount's own currency. */
  converted: boolean
}

const today = (): string => new Date().toISOString().slice(0, 10)

export interface UseDisplayBasisOptions {
  /**
   * The date to value at. Defaults to today.
   *
   * Passing the row's own date is what makes a historical figure defensible:
   * last March's sales valued at last March's gold price, not at this
   * morning's.
   */
  onDate?: string
}

export function useDisplayBasis(options: UseDisplayBasisOptions = {}) {
  const base = useCurrencyStore((state) => state.primaryCurrency)
  const basis = useCurrencyStore((state) => state.displayBasis)
  const storeSetBasis = useCurrencyStore((state) => state.setDisplayBasis)

  /**
   * ⚠️ VALIDATED, NOT CAST.
   *
   * `exchange_rates.currency_code` is free text on the server, so a workspace
   * can hold a rate for a code this build does not support. Casting it into
   * the store would put an unknown code where `CurrencyCode` is promised, and
   * every formatter downstream would then look up a precision and a sign that
   * do not exist — the §9 failure, which is a wrong AMOUNT rather than a
   * missing option.
   *
   * An unsupported code is refused. The picker never offers one, so this only
   * fires on a stale persisted value or a hand-crafted call.
   */
  const setBasis = useCallback(
    (code: string | null) => {
      if (code === null) {
        storeSetBasis(null)
        return
      }
      if (!isSupportedCurrency(code)) return
      storeSetBasis(code as CurrencyCode)
    },
    [storeSetBasis],
  )

  const { data: quotes, isLoading } = useExchangeRates()
  const onDate = options.onDate ?? today()

  // The basis is the workspace currency unless the user has chosen otherwise.
  const active = basis ?? base

  const convert = useCallback(
    (amount: number, from: string = base): DisplayAmount => {
      if (from === active) {
        return { value: amount, currency: active, available: true, converted: false }
      }

      const value = convertVia(amount, from, active, base, quotes ?? [], onDate)

      return {
        value,
        currency: active,
        available: value !== null,
        converted: true,
      }
    },
    [active, base, quotes, onDate],
  )

  /**
   * Every currency this workspace can actually display in.
   *
   * The base is always offered — it needs no rate. The rest appear only once a
   * rate exists for them, so the picker cannot offer a choice that would then
   * render «rate not set» on every card.
   */
  const availableBases = useMemo(() => {
    const codes = new Set<string>([base])
    for (const quote of quotes ?? []) {
      // Unsupported codes are dropped rather than offered: choosing one would
      // be refused by `setBasis`, so the option would silently do nothing.
      if (quote.rate > 0 && quote.onDate <= onDate && isSupportedCurrency(quote.currency)) {
        codes.add(quote.currency)
      }
    }
    return [...codes]
  }, [base, quotes, onDate])

  return {
    /** The currency amounts are being displayed in right now. */
    basis: active,
    /** The workspace's own currency — what amounts are actually stored in. */
    base,
    setBasis,
    convert,
    availableBases,
    isLoading,
    /** True when the user is looking at something other than their own books' currency. */
    isConverted: active !== base,
  }
}
