// ============================================
// packages/validation/src/schemas/universal-core/package-grant-allocation.domain.ts
//
// M5 - the ONE rule that decides, for a package CONSUME, which GRANTs it draws from, whether each of them may be used
// on that day, and how much deferred revenue each one releases.
//
// The same rule is run by TypeScript (the offline device and the tests), and it is mirrored in plpgsql by the trigger of
// docs/package-deferred-revenue-01-migration.sql. Both are proven against ONE set of golden vectors
// (packages/validation/src/__golden__/package-grant-vectors.json) - a change here without the vectors is a change nobody
// has checked.
//
// Decisions it encodes (docs/architecture/universal-business-core/M5-DECISIONS.md, batch 2):
//   B2-1 the term of a GRANT starts at its FIRST valid consume, never at the sale (SOLD != ACTIVATED);
//   B2-2 every GRANT keeps its own identity; an expired GRANT is skipped, never merged into another;
//   B2-3 a suspension belongs to ONE GRANT and only decides eligibility;
//   B2-4 deferred revenue is released per GRANT, never more than that GRANT holds, the last unit takes the exact rest.
//
// Order of consumption (assumption 1 of the prompt): the oldest GRANT first, ties by id - deterministic.
// ============================================

import { round2 } from '../money'

export interface GrantSuspension {
  /** First day the GRANT cannot be used (YYYY-MM-DD). */
  startsOn: string
  /** Last day it cannot be used; null = until lifted by a later ledger fact. */
  endsOn: string | null
}

export interface AllocatableGrant {
  id: string
  /** Day of the sale (the GRANT's effective date, YYYY-MM-DD). Not before this day. */
  startsOn: string
  quantity: number
  /** Net of every ADJUSTMENT that names this GRANT (a negative number reduces it). */
  adjustments?: number | undefined
  /** Books-currency net amount credited to deferred revenue; null = sold before the cut-over, never released. */
  deferredAmount: number | null
  /** 1 / 6 / 12; null = the package never expires. */
  termMonths: number | null
  /** Day of the first valid consume of this GRANT; null = never used yet (the term has not started). */
  activatedOn: string | null
  /** Units consumed so far, net of reversed consumptions. */
  consumedQuantity?: number | undefined
  /** Deferred amount released so far, net of reversed releases. */
  releasedAmount?: number | undefined
  suspensions?: GrantSuspension[] | undefined
}

/** An append-only suspension event of ONE GRANT. A GRANT is suspended from a SUSPEND until a later RESUME. */
export interface GrantSuspensionEvent {
  grantId: string
  kind: 'SUSPEND' | 'RESUME'
  effectiveOn: string
  /** Tie-break for two events on the same day (the order they were recorded). */
  order?: number | undefined
}

/** The days a GRANT is suspended, as intervals, from its events (the last event on or before a day decides). */
export function suspensionIntervals(events: GrantSuspensionEvent[]): GrantSuspension[] {
  const sorted = [...events].sort((a, b) =>
    a.effectiveOn === b.effectiveOn
      ? (a.order ?? 0) - (b.order ?? 0)
      : a.effectiveOn < b.effectiveOn
        ? -1
        : 1,
  )
  const out: GrantSuspension[] = []
  let open: string | null = null
  for (const event of sorted) {
    if (event.kind === 'SUSPEND' && open === null) open = event.effectiveOn
    if (event.kind === 'RESUME' && open !== null) {
      // resumed ON this day: the day before is the last suspended day
      const last = new Date(`${event.effectiveOn}T00:00:00Z`)
      last.setUTCDate(last.getUTCDate() - 1)
      const endsOn = last.toISOString().slice(0, 10)
      if (endsOn >= open) out.push({ startsOn: open, endsOn })
      open = null
    }
  }
  if (open !== null) out.push({ startsOn: open, endsOn: null })
  return out
}

export type GrantState = 'not_started' | 'active' | 'expired' | 'suspended'

/** `YYYY-MM-DD` plus whole months, clamped to the end of a shorter month (the same as Postgres interval addition). */
export function addMonthsIso(day: string, months: number): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number]
  const total = y * 12 + (m - 1) + months
  const year = Math.floor(total / 12)
  const month = (total % 12) + 1
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const date = new Date(Date.UTC(year, month - 1, Math.min(d, last)))
  return date.toISOString().slice(0, 10)
}

/** Last day (inclusive) a GRANT can be used; null when it has no term or has not started yet. */
export function grantEndsOn(
  grant: Pick<AllocatableGrant, 'termMonths' | 'activatedOn'>,
): string | null {
  if (!grant.termMonths || !grant.activatedOn) return null
  return addMonthsIso(grant.activatedOn, grant.termMonths)
}

/** Whether a GRANT may be used on `onDate`. Pure; the answer for "expired" never depends on a device clock. */
export function grantStateOn(grant: AllocatableGrant, onDate: string): GrantState {
  if (onDate < grant.startsOn) return 'not_started'
  const endsOn = grantEndsOn(grant)
  if (endsOn !== null && onDate > endsOn) return 'expired'
  const suspended = (grant.suspensions ?? []).some(
    (s) => s.startsOn <= onDate && (s.endsOn === null || onDate <= s.endsOn),
  )
  return suspended ? 'suspended' : 'active'
}

export interface GrantAllocation {
  /** null = the part of the consume covered by balance that no GRANT owns (a manual top-up); it releases nothing. */
  grantId: string | null
  quantity: number
  releasedAmount: number
}

export interface GrantConsumePlan {
  allocations: GrantAllocation[]
  totalReleasedAmount: number
  /** Units no eligible GRANT (and no unattributed balance) could cover. > 0 means the consume must be refused. */
  shortfall: number
}

/**
 * Allocate a consume of `quantity` units on `onDate` over the eligible GRANTs, oldest first.
 * `unattributedAvailable` is the balance that belongs to no GRANT (manual top-ups) - used only after every GRANT.
 */
export function planGrantConsumption(
  grants: AllocatableGrant[],
  quantity: number,
  onDate: string,
  unattributedAvailable = 0,
): GrantConsumePlan {
  if (!(quantity > 0)) throw new Error('CONSUMPTION_QUANTITY_MUST_BE_POSITIVE')

  const ordered = [...grants].sort((a, b) =>
    a.startsOn === b.startsOn ? (a.id < b.id ? -1 : 1) : a.startsOn < b.startsOn ? -1 : 1,
  )

  let needed = quantity
  let totalReleased = 0
  const allocations: GrantAllocation[] = []

  for (const grant of ordered) {
    if (needed <= 0) break
    if (grantStateOn(grant, onDate) !== 'active') continue

    const available = round4(
      grant.quantity + (grant.adjustments ?? 0) - (grant.consumedQuantity ?? 0),
    )
    if (available <= 0) continue

    const take = Math.min(needed, available)
    let released = 0
    if (grant.deferredAmount !== null) {
      const remaining = Math.max(0, round2(grant.deferredAmount - (grant.releasedAmount ?? 0)))
      // The last unit of an UNADJUSTED GRANT takes the exact rest: no rounding drift, never more than it holds. A GRANT
      // an ADJUSTMENT has reduced keeps the value of the removed units as liability (they were not delivered).
      const exhausts = take === available && (grant.adjustments ?? 0) === 0
      released = exhausts
        ? remaining
        : Math.min(remaining, round2((take * grant.deferredAmount) / grant.quantity))
    }
    allocations.push({ grantId: grant.id, quantity: take, releasedAmount: released })
    totalReleased = round2(totalReleased + released)
    needed = round4(needed - take)
  }

  if (needed > 0 && unattributedAvailable > 0) {
    const take = Math.min(needed, unattributedAvailable)
    allocations.push({ grantId: null, quantity: take, releasedAmount: 0 })
    needed = round4(needed - take)
  }

  return { allocations, totalReleasedAmount: totalReleased, shortfall: needed }
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000
}

// ─── From ledger facts to allocatable GRANTs (what the device reads from SQLite; the SQL trigger reads the same rows) ──

export interface LedgerGrantFact {
  id: string
  startsOn: string
  quantity: number
  deferredAmount: number | null
  termMonths: number | null
}

export interface LedgerAllocationFact {
  /** The CONSUME (or REVERSAL) ledger entry the row belongs to. */
  entryId: string
  grantId: string | null
  kind: 'CONSUME' | 'REVERSAL'
  quantity: number
  releasedAmount: number
  /** Effective date of that entry. */
  effectiveDate: string
}

/**
 * The GRANTs of one (customer, package) as the allocation rule needs them.
 *
 * - consumed / released are net of reversals;
 * - the term starts at the first CONSUME that has not been reversed (SOLD != ACTIVATED);
 * - consumptions written before allocation existed (`legacyConsumed`, no allocation rows) are charged, oldest first, to
 *   GRANTs that carry no deferred amount - never counted twice, never released.
 */
export function allocatableGrantsFromFacts(input: {
  grants: LedgerGrantFact[]
  adjustments: Array<{ grantId: string; quantity: number }>
  allocations: LedgerAllocationFact[]
  reversedConsumeIds: ReadonlySet<string>
  suspensionEvents: GrantSuspensionEvent[]
  legacyConsumed: number
}): AllocatableGrant[] {
  const ordered = [...input.grants].sort((a, b) =>
    a.startsOn === b.startsOn ? (a.id < b.id ? -1 : 1) : a.startsOn < b.startsOn ? -1 : 1,
  )
  let legacyLeft = Math.max(0, input.legacyConsumed)

  return ordered.map((grant) => {
    const mine = input.allocations.filter((a) => a.grantId === grant.id)
    const consumed = round4(
      mine.reduce((sum, a) => sum + (a.kind === 'CONSUME' ? a.quantity : -a.quantity), 0),
    )
    const released = round2(
      mine.reduce(
        (sum, a) => sum + (a.kind === 'CONSUME' ? a.releasedAmount : -a.releasedAmount),
        0,
      ),
    )
    const adjustments = round4(
      input.adjustments
        .filter((a) => a.grantId === grant.id)
        .reduce((sum, a) => sum + a.quantity, 0),
    )
    const activations = mine
      .filter((a) => a.kind === 'CONSUME' && !input.reversedConsumeIds.has(a.entryId))
      .map((a) => a.effectiveDate)
      .sort()

    let legacyTake = 0
    if (grant.deferredAmount === null && legacyLeft > 0) {
      legacyTake = Math.min(legacyLeft, Math.max(grant.quantity + adjustments - consumed, 0))
      legacyLeft = round4(legacyLeft - legacyTake)
    }

    return {
      id: grant.id,
      startsOn: grant.startsOn,
      quantity: grant.quantity,
      adjustments,
      deferredAmount: grant.deferredAmount,
      termMonths: grant.termMonths,
      activatedOn: activations[0] ?? null,
      consumedQuantity: round4(consumed + legacyTake),
      releasedAmount: released,
      suspensions: suspensionIntervals(
        input.suspensionEvents.filter((s) => s.grantId === grant.id),
      ),
    }
  })
}

/** Balance no GRANT owns (positive manual top-ups) that is still unspent. */
export function unattributedBalance(input: {
  manualTopUps: number
  allocations: LedgerAllocationFact[]
}): number {
  const spent = input.allocations
    .filter((a) => a.grantId === null)
    .reduce((sum, a) => sum + (a.kind === 'CONSUME' ? a.quantity : -a.quantity), 0)
  return round4(input.manualTopUps - spent)
}

// ─── What the customer sees: one row per GRANT, today ────────────────────────────────────────────────────────

export interface GrantStatus {
  id: string
  /** Day of the sale. */
  soldOn: string
  quantity: number
  /** Units still unspent on this GRANT. */
  remaining: number
  termMonths: number | null
  /** Day of the first valid consume; null = never used, so the term has not started (SOLD != ACTIVATED). */
  activatedOn: string | null
  /** Last day the GRANT can be used; null = no term, or not started. */
  endsOn: string | null
  /** Usable on `today`? */
  state: GrantState
  /** Books-currency net amount the sale deferred for this GRANT; null = sold before deferral. */
  deferredAmount: number | null
}

/** The status of every GRANT on `today`. Server and device call this with the facts they read; nobody re-derives it. */
export function grantStatuses(
  input: Parameters<typeof allocatableGrantsFromFacts>[0],
  today: string,
): GrantStatus[] {
  return allocatableGrantsFromFacts(input).map((grant) => ({
    id: grant.id,
    soldOn: grant.startsOn,
    quantity: grant.quantity,
    remaining: Math.max(
      0,
      round4(grant.quantity + (grant.adjustments ?? 0) - (grant.consumedQuantity ?? 0)),
    ),
    termMonths: grant.termMonths,
    activatedOn: grant.activatedOn,
    endsOn: grantEndsOn(grant),
    state: grantStateOn(grant, today),
    deferredAmount: grant.deferredAmount,
  }))
}
