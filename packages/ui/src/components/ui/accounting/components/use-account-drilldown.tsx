'use client'

// ============================================
// packages/ui/src/components/ui/accounting/components/use-account-drilldown.tsx
//
// H3 — one drill-down, wired once, used by three reports.
//
// The Trial Balance, the Balance Sheet and the Income Statement all answer the
// same question about a figure — «which lines make this up?» — and all three
// must answer it FOR THE SAME PERIOD they are displaying. Three copies of that
// wiring is three chances for one report to open the drawer with the wrong
// window and produce a list that does not add up to the number clicked.
//
// So the period is an argument and the rest is here.
// ============================================

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useGeneralLedger } from '@hisabche/api'

import { AccountLedgerDrawer } from './account-ledger-drawer'

export interface DrillDownAccount {
  id: string
  code: string
  name: string
}

/**
 * @param from  Start of the window, or `''` for «since the beginning».
 * @param to    End of the window — the date the report is stated as at.
 * @param t     The tab's own translator.
 */
export function useAccountDrilldown(
  from: string,
  to: string,
  t: (key: string, fallback?: string) => string,
) {
  const router = useRouter()
  const [account, setAccount] = useState<DrillDownAccount | null>(null)

  // `enabled` inside the hook gates on the id, so a closed drawer issues no
  // request. Opening it is what starts the query.
  const { data, isLoading } = useGeneralLedger(account?.id, from, to)

  const open = useCallback((next: DrillDownAccount) => setAccount(next), [])
  const close = useCallback(() => setAccount(null), [])

  const drawer = (
    <AccountLedgerDrawer
      t={t}
      account={account}
      from={from}
      to={to}
      isLoading={isLoading}
      openingBalance={data?.openingBalance ?? 0}
      closingBalance={data?.closingBalance ?? 0}
      lines={data?.lines ?? []}
      onClose={close}
      // The drawer closes on navigation. Leaving it open over the invoice the
      // user just opened would hide the thing they asked to see.
      onNavigate={(route) => {
        close()
        router.push(route)
      }}
    />
  )

  return { open, close, drawer, openAccountId: account?.id ?? null }
}
