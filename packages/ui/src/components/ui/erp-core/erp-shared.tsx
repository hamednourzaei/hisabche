'use client'
// ============================================
// Shared pieces of the V61 audit screens (RFQ, consignment, org chart,
// bundles, RFM, snapshots) — and of the cheque register.
//
// ⚠️ `DataTable` resolves a column's `labelKey` as a FULL key
// («erpCore.rfq.columns.title»). Handing it a namespace-scoped reader looks up
// «erpCore.erpCore.…», which does not exist, and `t()` throws on a missing key
// — the whole page goes to the error boundary. `useTableLabel` reads full keys.
// ============================================
import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { apiErrorMessage } from '@hisabche/api'

import { translateOr } from '../../../lib/translate-or'
import { Button } from '../button'
import type { SelectFieldOption } from '../select-field'

/** A reader for `DataTable`'s `t` prop: full keys, with the column's fallback. */
export function useTableLabel(): (key: string, fallback?: string) => string {
  const tAll = useTranslations()
  // `translateOr`, not `t.has`: the desktop shell's shim has no `has`.
  return (key: string, fallback?: string): string => translateOr(tAll, key, fallback ?? key)
}

/**
 * The refusal the server named, as this screen's sentence — or the general
 * one. Codes are matched against a closed list, never passed to `t()` raw.
 */
export function refusalText(
  error: unknown,
  known: readonly string[],
  tr: (key: string) => string,
): string {
  const raw = apiErrorMessage(error, '')
  const code = known.find((candidate) => raw.includes(candidate))
  return code ? tr(`errors.${code}`) : tr('errors.general')
}

/** Loading, failed (with retry) and loaded are three different screens — never one. */
export function QueryState({
  isLoading,
  isError,
  onRetry,
  loadingText,
  errorText,
  retryText,
  children,
}: {
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  loadingText: string
  errorText: string
  retryText: string
  children: ReactNode
}) {
  if (isLoading) {
    return (
      <p role="status" className="text-sm text-[hsl(var(--fg-secondary))]">
        {loadingText}
      </p>
    )
  }
  if (isError) {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center gap-2 rounded-xl border border-[hsl(var(--color-destructive))] p-3 text-sm"
      >
        <span>{errorText}</span>
        <Button size="sm" variant="outline" onClick={onRetry}>
          {retryText}
        </Button>
      </div>
    )
  }
  return <>{children}</>
}

/** An option's label as text (labels may be nodes), or a short id when it is not loaded. */
export function optionText(options: readonly SelectFieldOption[], id: string): string {
  const found = options.find((option) => option.value === id)?.label
  return typeof found === 'string' ? found : id.slice(0, 8)
}

export const erpCard =
  'grid gap-3 rounded-2xl border border-[hsl(var(--border-default))] p-4 sm:grid-cols-3'

export const fieldLabel = 'space-y-1 text-xs text-[hsl(var(--fg-secondary))]'
