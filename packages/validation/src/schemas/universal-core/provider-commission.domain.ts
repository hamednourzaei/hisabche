// ============================================
// packages/validation/src/schemas/universal-core/provider-commission.domain.ts
//
// V54 (8 Nov 2026) — what each service provider earned as commission, as a
// REPORT. Owner decision N-7: a percent of the service, per provider; it is not
// posted to the ledger and not wired to payroll — the person pays it the way
// they pay staff today.
//
// Rules:
//   · only DELIVERED sessions count (scheduled, in progress, no-show and
//     cancelled earned nothing);
//   · the base is the service's price, in its own currency — never added across
//     currencies (one row per provider × currency);
//   · a provider with no rate has commission `null` — unknown, not zero;
//   · a service with no readable price is counted apart (`unpriced`), never as 0;
//   · a session with no provider is counted apart (`unassigned`);
//   · rate in basis points (2500 = 25%), commission in integer minor units,
//     rounded half away from zero once per row.
// ============================================

import { z } from 'zod'

export const providerCommissionRateSchema = z.object({
  rateBp: z.number().int().min(0).max(10_000),
})

export interface CommissionSession {
  readonly practitionerId: string | null | undefined
  readonly serviceOfferingId: string
  readonly status: string
}

export interface CommissionServicePrice {
  /** Integer minor units of `currency`; null = no price could be read. */
  readonly priceMinor: number | null
  readonly currency: string | null
}

export interface ProviderCommissionRow {
  readonly practitionerId: string
  readonly currency: string
  readonly sessions: number
  readonly baseMinor: number
  /** null = no rate set for this provider. */
  readonly rateBp: number | null
  /** null when the rate is unknown — never 0 for «not set». */
  readonly commissionMinor: number | null
}

export interface ProviderCommissionReport {
  readonly rows: readonly ProviderCommissionRow[]
  /** Delivered sessions whose service price could not be read. */
  readonly unpriced: number
  /** Delivered sessions with no provider named. */
  readonly unassigned: number
}

export function buildProviderCommissionReport(
  sessions: readonly CommissionSession[],
  prices: ReadonlyMap<string, CommissionServicePrice>,
  rates: ReadonlyMap<string, number>,
): ProviderCommissionReport {
  const groups = new Map<
    string,
    { practitionerId: string; currency: string; sessions: number; baseMinor: number }
  >()
  let unpriced = 0
  let unassigned = 0

  for (const session of sessions) {
    if (session.status !== 'delivered') continue
    if (!session.practitionerId) {
      unassigned += 1
      continue
    }
    const price = prices.get(session.serviceOfferingId)
    if (!price || price.priceMinor === null || !price.currency) {
      unpriced += 1
      continue
    }
    const key = `${session.practitionerId}|${price.currency}`
    const group = groups.get(key) ?? {
      practitionerId: session.practitionerId,
      currency: price.currency,
      sessions: 0,
      baseMinor: 0,
    }
    group.sessions += 1
    group.baseMinor += price.priceMinor
    groups.set(key, group)
  }

  const rows = [...groups.values()]
    .map((group): ProviderCommissionRow => {
      const rate = rates.get(group.practitionerId)
      const rateBp = rate === undefined ? null : rate
      return {
        ...group,
        rateBp,
        commissionMinor:
          rateBp === null
            ? null
            : Math.sign(group.baseMinor) *
              Math.round((Math.abs(group.baseMinor) * rateBp) / 10_000),
      }
    })
    .sort(
      (a, b) =>
        a.practitionerId.localeCompare(b.practitionerId) || a.currency.localeCompare(b.currency),
    )

  return { rows, unpriced, unassigned }
}
