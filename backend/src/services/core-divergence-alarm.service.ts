// ============================================
// backend/src/services/core-divergence-alarm.service.ts
//
// Reads `core_divergence` and answers «how often has the shared core disagreed,
// per capability, in this window».
//
// ⚠️ WHY THE RATE IS A RATIO OF OPPORTUNITIES, NOT A COUNT.
//
// «12 divergences» says nothing: twelve out of twelve is an outage, twelve out of
// a million is noise. The denominator is the number of times the core was
// COMPARED, which the alarm worker counts from the same window (payments
// recorded, in the payment case). The judgement itself lives in
// `@hisabche/validation` (`evaluateDivergenceWindow`) so a dashboard or a support
// query cannot compute a second, different rate.
//
// ⚠️ A FAILED READ IS REPORTED AS A FAILED READ. It is never an empty window:
// «no divergences» and «the query broke» must not look the same
// (`read-error-not-404` is the same law elsewhere in this repo).
// ============================================

import { supabase } from '../db'
import { selectAllPages } from '../utils/fetch-all-pages'

export interface CapabilityDivergenceWindow {
  capability: string
  divergences: number
  /** The oldest row in the window, so an operator can see what «the window» was. */
  since: string
  until: string
}

export interface DivergenceWindowRead {
  windows: CapabilityDivergenceWindow[]
  /** Per-capability read failures, reported rather than swallowed. */
  errors: { capability: string; reason: string }[]
}

const COLUMNS = 'capability, detected_at'

/**
 * Divergences per capability between two instants.
 *
 * ⚠️ IT PAGES, IT DOES NOT `.limit()`. PostgREST cuts every response at
 * `max-rows` (1000) and says nothing, so `.limit(2000)` would have returned 1000
 * rows and reported a smaller rate on exactly the day the rate mattered — the
 * «silent row cap» this repo already paid for once
 * (`no-silent-row-cap.test.ts` caught the first version of this function doing
 * it). `selectAllPages` is the shared pager; it throws rather than returning a
 * partial page.
 *
 * Counts in memory rather than issuing one `count` per capability, because the
 * table is small by construction — a row is written only when the core and the
 * server DISAGREE — and `count: 'estimated'` would report a planner guess for
 * the number a decision is made on.
 */
export async function readDivergenceWindows(
  since: string,
  until: string,
): Promise<DivergenceWindowRead> {
  const page = (from: number, to: number) =>
    supabase
      .from('core_divergence')
      .select(COLUMNS)
      .gte('detected_at', since)
      .lt('detected_at', until)
      .order('detected_at', { ascending: true })
      .range(from, to)

  const { data, error } = await selectAllPages<
    { capability: string; detected_at: string },
    { message: string }
  >(page)

  if (error) {
    return { windows: [], errors: [{ capability: '*', reason: error.message }] }
  }

  const rows = data ?? []

  const byCapability = new Map<string, CapabilityDivergenceWindow>()
  for (const row of rows) {
    const existing = byCapability.get(row.capability)
    if (existing) {
      existing.divergences += 1
    } else {
      byCapability.set(row.capability, {
        capability: row.capability,
        divergences: 1,
        since,
        until,
      })
    }
  }

  return { windows: [...byCapability.values()], errors: [] }
}

/**
 * How many times a capability was COMPARED in the window — the denominator.
 *
 * Only capabilities whose shadow check runs on a countable operation have one.
 * An unknown capability returns `null`, which the rule treats as «cannot judge»
 * rather than as zero (a zero denominator would make the rate infinite, and a
 * guessed one would make it meaningless).
 */
export async function countComparisons(
  capability: string,
  since: string,
  until: string,
): Promise<number | null> {
  switch (capability) {
    case 'payment.record': {
      // Every recorded payment is one comparison. Uses the same exact count
      // discipline as the rest of the money path: `count: 'exact', head: true`
      // so the number is the table's answer, not the planner's estimate.
      const { count, error } = await supabase
        .from('payments')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', since)
        .lt('created_at', until)
      if (error) throw new Error(`Failed to count payments in window: ${error.message}`)
      return count ?? null
    }
    default:
      return null
  }
}
