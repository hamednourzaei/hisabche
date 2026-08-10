// ============================================
// Runs a per-item mutation across a selection.
//
// There is no bulk endpoint in the API, so a bulk action is N single-item
// calls. That has consequences this hook owns rather than leaving to callers:
//
//  - Partial failure is normal. Nine deletes succeeding and one failing must
//    not read as "failed" — the nine really are gone.
//  - Requests run in bounded batches. Firing 200 deletes at once would stall
//    the connection pool and trip rate limiting.
// ============================================

'use client'

import { useCallback, useState } from 'react'

export interface BulkActionResult {
  succeeded: readonly string[]
  failed: readonly string[]
}

export interface BulkActionState {
  busy: boolean
  /** Result of the most recent run, or null before the first one. */
  result: BulkActionResult | null
  run: (ids: readonly string[]) => Promise<BulkActionResult>
  reset: () => void
}

/** Concurrent in-flight requests. Enough to be quick, low enough to be polite. */
const BATCH_SIZE = 5

export function useBulkAction(mutate: (id: string) => Promise<unknown>): BulkActionState {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<BulkActionResult | null>(null)

  const run = useCallback(
    async (ids: readonly string[]): Promise<BulkActionResult> => {
      const succeeded: string[] = []
      const failed: string[] = []

      setBusy(true)
      setResult(null)

      try {
        for (let start = 0; start < ids.length; start += BATCH_SIZE) {
          const batch = ids.slice(start, start + BATCH_SIZE)

          // `allSettled`, not `all`: one rejection must not abandon the rest of
          // the batch, and the caller needs to know exactly which ids survived.
          const settled = await Promise.allSettled(batch.map((id) => mutate(id)))

          settled.forEach((outcome, index) => {
            const id = batch[index] as string
            if (outcome.status === 'fulfilled') succeeded.push(id)
            else failed.push(id)
          })
        }
      } finally {
        setBusy(false)
      }

      const next: BulkActionResult = { succeeded, failed }
      setResult(next)
      return next
    },
    [mutate],
  )

  const reset = useCallback(() => setResult(null), [])

  return { busy, result, run, reset }
}
