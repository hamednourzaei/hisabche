// ============================================
// The device's «primary currency» follows the business's books currency.
//
// Every amount in the product is formatted from `useCurrencyStore.primaryCurrency`
// — a value kept in THIS device's storage. It was set once, by the onboarding
// wizard, on the device that ran it; a second device, or the same one after
// its storage was cleared, fell back to the store's built-in value and showed
// a toman business its amounts under another currency's name.
//
// The books currency is the server's (`workspaces.base_currency`). This
// renders nothing: when the server's answer arrives, or changes, it is written
// into the store the screens already read. Mounted once in each shell.
//
// ⚠️ It writes only when the SERVER's value changes — not on every render —
// so a currency a person picks for one invoice is not snapped back under them.
// ============================================
'use client'

import { useEffect } from 'react'
import { useBaseCurrency } from '@hisabche/api'
import { useCurrencyStore, type CurrencyCode } from '@hisabche/store'

export function BookCurrencySync(): null {
  const books = useBaseCurrency().data?.currency
  const setPrimaryCurrency = useCurrencyStore((state) => state.setPrimaryCurrency)

  useEffect(() => {
    if (books) setPrimaryCurrency(books as CurrencyCode)
  }, [books, setPrimaryCurrency])

  return null
}
