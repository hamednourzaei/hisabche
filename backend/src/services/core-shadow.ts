// ============================================
// backend/src/services/core-shadow.ts
//
// SHADOW VERIFICATION — re-derive a stored money document with the shared core
// and record any disagreement.
//
// ⚠️ WHY THE CALL IS HERE AND NOT IN THE SYNC ROUTE.
//
// `CoreDivergenceService` existed with a passing test suite and NO caller, so
// «zero divergence» meant «nobody looked». The obvious place to call it —
// `POST /api/sync/push` — would have been theatre: that route is an allow-list
// that cannot carry money at all. `sync.service.ts` WRITABLE gives an invoice
// only `notes, reference, due_date`, and `warehouse`, `branch`,
// `exchange_rate`, `product_stock` are read-only arrays. A money comparison
// there compares nothing, every time, and passes — which is exactly what the
// shadow mode is supposed to catch, not imitate.
//
// The honest place is a route where money really arrives. `POST /api/payments`
// validates its INPUT through the core and writes through a Postgres function;
// what nothing compared is what was STORED against what the core derives from
// the same facts. That comparison is below, and it is called from the real
// route handler.
//
// ⚠️ SHADOW MODE NEVER CHANGES THE ANSWER. It records. It does not correct,
// reject or retry: a divergence that silently altered a payment would be the
// very bug it exists to detect.
// ============================================

import { paymentPosting, type PaymentDirection } from '@hisabche/validation'
import type { TenancyContext } from './tenancy.service'
import { CoreDivergenceService, type CoreDivergenceRecord } from './core-divergence.service'

/** The facts a payment's journal entry is derived from. */
export interface PaymentFacts {
  direction: PaymentDirection
  /** Amount in the payment's own currency, major units. */
  amount: number
  /** The rate that converts the payment into books currency. */
  paymentRate: number
  /**
   * Each allocation: what it settles, and the rate that brought it into books
   * currency. `null` means «same as the payment» — which is what
   * `paymentPosting` expects.
   */
  allocations: { amount: number; rate: number | null }[]
  /** In the payment's own currency. Absent or zero = none. */
  fee: number
}

/** The money the database actually holds for the same payment. */
export interface StoredPaymentPosting {
  cash: number
  party: number
  difference: number
  fee: number
}

export interface ShadowOutcome {
  checked: boolean
  diverged: boolean
  reason?: 'shadow_off' | 'kill_switch' | 'core_threw'
  /** What the core derived, for logging. Present only when `checked`. */
  expected?: StoredPaymentPosting
}

/**
 * The comparison itself: what the core derives, and where the stored posting
 * differs from it.
 *
 * Split out from the recording so the decision can be tested without a database
 * or a Supabase client — the guard that keeps shadow mode honest is the
 * decision, not the insert.
 */
export function comparePaymentPosting(
  facts: PaymentFacts,
  stored: StoredPaymentPosting,
): { expected: StoredPaymentPosting; differences: string[] } | { coreThrew: true } {
  // ⚠️ THE CORE DOES NOT THROW ON A NON-FINITE INPUT, AND IT DOES NOT RETURN
  // NaN EITHER — `round2` turns anything non-finite into 0 (`schemas/money.ts`
  // line 46). So a payment whose amount arrived as NaN derives a spotless
  // ZERO posting, which would then be compared against a real stored amount
  // and recorded as a divergence the code itself invented.
  //
  // The facts are checked first, and an input the core cannot express is
  // reported as such — never as a money difference.
  const factsAreFinite =
    Number.isFinite(facts.amount) &&
    Number.isFinite(facts.paymentRate) &&
    Number.isFinite(facts.fee) &&
    facts.allocations.every((a) => Number.isFinite(a.amount))
  if (!factsAreFinite) return { coreThrew: true }

  let derived: ReturnType<typeof paymentPosting>
  try {
    derived = paymentPosting({
      direction: facts.direction,
      amount: facts.amount,
      paymentRate: facts.paymentRate,
      allocations: facts.allocations,
      fee: facts.fee,
    })
  } catch {
    // The core could not express this payment. That is worth knowing, but it is
    // not a difference of VALUES, and recording it as one would bury the signal.
    return { coreThrew: true }
  }

  const expected: StoredPaymentPosting = {
    cash: derived.cash,
    party: derived.party,
    difference: derived.difference,
    fee: derived.fee,
  }

  // ⚠️ THE CORE DOES NOT THROW ON A NON-FINITE INPUT — it propagates NaN
  // through every amount (`paymentPosting` multiplies and rounds without a
  // guard). Comparing NaN with `!==` would report a "divergence" on every
  // field for a payment the core simply could not express, burying the real
  // signal. Treat it as unexpressible, not as a difference.
  if (!Object.values(expected).every((value) => Number.isFinite(value))) {
    return { coreThrew: true }
  }

  const keys = ['cash', 'party', 'difference', 'fee'] as const
  const differences = keys
    .filter((key) => minorOf(expected[key]) !== minorOf(stored[key]))
    .map((key) => `${key}: core ${minorOf(expected[key])} vs stored ${minorOf(stored[key])}`)

  return { expected, differences }
}

/**
 * Compare the stored posting of a payment with the core's answer for the same
 * facts, and record a divergence row when they differ.
 *
 * Returns a value instead of throwing: a diagnostic that can fail a payment is
 * a worse bug than the one it is looking for.
 */
export async function verifyPaymentPosting(
  context: TenancyContext,
  facts: PaymentFacts,
  stored: StoredPaymentPosting,
): Promise<ShadowOutcome> {
  const capability = 'payment.record'

  // The kill switch takes a capability back to the server path; while it is on,
  // verification for it is off as well.
  if (CoreDivergenceService.getAuthority(capability) === 'SERVER_LEGACY') {
    return { checked: false, diverged: false, reason: 'kill_switch' }
  }
  if (!CoreDivergenceService.isShadowModeEnabled()) {
    return { checked: false, diverged: false, reason: 'shadow_off' }
  }

  const comparison = comparePaymentPosting(facts, stored)
  if ('coreThrew' in comparison) {
    return { checked: false, diverged: false, reason: 'core_threw' }
  }

  const { expected, differences } = comparison
  const diverged = differences.length > 0
  if (diverged) {
    const record: CoreDivergenceRecord = {
      workspaceId: context.workspaceId,
      capability,
      command: 'POST /api/payments',
      commandPayload: {
        direction: facts.direction,
        amount: facts.amount,
        paymentRate: facts.paymentRate,
        fee: facts.fee,
        allocations: facts.allocations,
      },
      expectedOutput: expected,
      actualOutput: stored,
      diffSummary: `DIVERGENCE ${differences.join('; ')}`,
    }
    await CoreDivergenceService.recordDivergence(record)
  }

  return { checked: true, diverged, expected }
}

/** Minor units, so a float artefact is not reported as a money difference. */
function minorOf(value: number | undefined): number {
  return Math.round((Number(value) || 0) * 100)
}
