'use client'

// ============================================
// packages/ui/src/hooks/use-book-currency.ts
//
// The currency this business keeps its books in, for a screen.
//
// ⚠️ There is no fallback here, on purpose. While it has not arrived this is
// `undefined`, and a screen shows an amount without a currency label for that
// moment rather than under a label it made up. The value is the server's
// (GET /finance/currency/base); no page carries a currency of its own.
// ============================================

import { useBaseCurrency } from '@hisabche/api'

export function useBookCurrency(): string | undefined {
  return useBaseCurrency().data?.currency
}
