// ============================================
// packages/validation/src/schemas/salon.ts
//
// Barber shop and multi-department beauty salon (QA document §8, 10 Nov 2026):
// one service core, the difference is departments and how many resources.
//
//   • service catalog — each service's duration, department, the kind of
//     resource it needs, and the materials one delivery uses;
//   • resources — chairs, rooms, beds; a session can hold one, and two
//     sessions can never hold the same one at the same time (database trigger);
//   • departments — the existing HR departments (hair, nails, skin), not a
//     second list;
//   • consumables — the service's recipe; when a session is delivered and the
//     screen names no materials, delivery uses it through the existing
//     ServiceDeliveryService#consumeMaterials (cost, stock, one ledger entry);
//   • commission — rate per provider (provider_commission_rates) × what the
//     delivered session was charged. A session whose charge cannot be read is
//     «unknown», never zero.
//
// A barber shop uses none of departments/resources and nothing asks it to.
// ============================================

import { z } from 'zod'
import { minutesOf } from './attendance-rules'

export const RESOURCE_KINDS = [
  'chair',
  'room',
  'bed',
  'station',
  'equipment',
  'table',
  'vehicle',
  'machine',
  'court',
] as const
export type ResourceKind = (typeof RESOURCE_KINDS)[number]

export const serviceResourceSchema = z.object({
  name: z.string().trim().min(1).max(80),
  kind: z.enum(RESOURCE_KINDS),
  branchId: z.string().uuid().nullable().optional(),
  departmentId: z.string().uuid().nullable().optional(),
})
export type ServiceResourceInput = z.infer<typeof serviceResourceSchema>

export const serviceResourcePatchSchema = serviceResourceSchema
  .partial()
  .extend({ isActive: z.boolean().optional() })
export type ServiceResourcePatch = z.infer<typeof serviceResourcePatchSchema>

export const serviceCatalogSchema = z.object({
  durationMinutes: z
    .number()
    .int()
    .min(5)
    .max(24 * 60),
  departmentId: z.string().uuid().nullable().optional(),
  /** The kind of resource the service needs; null = none (a barber's chair is not tracked). */
  resourceKind: z.enum(RESOURCE_KINDS).nullable().optional(),
  /** The warehouse materials leave from; required when there are materials and warehouses. */
  warehouseId: z.string().uuid().nullable().optional(),
  consumables: z
    .array(
      z.object({
        productId: z.string().uuid(),
        /** Per one delivery, in the product's base unit (0.02 bottle of dye). */
        quantity: z.number().positive().max(100_000),
      }),
    )
    .max(30)
    .default([]),
})
export type ServiceCatalogInput = z.infer<typeof serviceCatalogSchema>

export function catalogRefusal(input: ServiceCatalogInput): 'SERVICE_CONSUMABLE_DUPLICATE' | null {
  const ids = input.consumables.map((c) => c.productId)
  return new Set(ids).size !== ids.length ? 'SERVICE_CONSUMABLE_DUPLICATE' : null
}

/** Two sessions on the same day overlap when each starts before the other ends. */
export function sessionsOverlap(
  a: { readonly start: string; readonly end: string },
  b: { readonly start: string; readonly end: string },
): boolean {
  // Stored as «HH:MM» or «HH:MM:SS»; the minute is what matters.
  const at = (t: string) => minutesOf(t.slice(0, 5))
  const [as, ae, bs, be] = [at(a.start), at(a.end), at(b.start), at(b.end)]
  if (as === null || ae === null || bs === null || be === null) return false
  return as < be && bs < ae
}

// ─── Commission ──────────────────────────────────────────────────────────────

export const commissionRateSchema = z.object({
  employeeId: z.string().uuid(),
  /** Basis points: 3500 = 35%. */
  rateBp: z.number().int().min(0).max(10_000),
})
export type CommissionRateInput = z.infer<typeof commissionRateSchema>

export interface CommissionSession {
  readonly practitionerId: string | null
  readonly currency: string | null
  /** What the session was charged, minor units of `currency`; null = cannot be read. */
  readonly chargedMinor: number | null
}

export interface CommissionLine {
  readonly practitionerId: string
  readonly currency: string | null
  readonly sessions: number
  /** Sessions whose charge could not be read — their commission is not in the total. */
  readonly unknownSessions: number
  readonly baseMinor: number
  readonly rateBp: number | null
  /** null when the provider has no rate (unknown, not zero). */
  readonly commissionMinor: number | null
}

/**
 * Per provider and currency. A provider without a rate gets `null`
 * commission; a session without a readable charge is counted, not valued.
 * Sessions with no provider are not anyone's commission and are left out.
 */
export function commissionReport(
  sessions: readonly CommissionSession[],
  rates: ReadonlyMap<string, number>,
): CommissionLine[] {
  const lines = new Map<
    string,
    {
      practitionerId: string
      currency: string | null
      sessions: number
      unknownSessions: number
      baseMinor: number
    }
  >()
  for (const session of sessions) {
    if (!session.practitionerId) continue
    const key = `${session.practitionerId}|${session.currency ?? ''}`
    const line = lines.get(key) ?? {
      practitionerId: session.practitionerId,
      currency: session.currency,
      sessions: 0,
      unknownSessions: 0,
      baseMinor: 0,
    }
    line.sessions += 1
    if (session.chargedMinor === null) line.unknownSessions += 1
    else line.baseMinor += session.chargedMinor
    lines.set(key, line)
  }
  return [...lines.values()].map((line) => {
    const rateBp = rates.get(line.practitionerId) ?? null
    return {
      ...line,
      rateBp,
      commissionMinor: rateBp === null ? null : Math.round((line.baseMinor * rateBp) / 10_000),
    }
  })
}

export const providerAllocationSchema = z.object({
  employeeId: z.string().uuid(),
  /** Share of this session in basis points (sum across providers must equal 10,000). */
  shareBp: z.number().int().positive().max(10_000),
})
export type ProviderAllocation = z.infer<typeof providerAllocationSchema>

export interface AllocatedCommissionResult {
  readonly employeeId: string
  readonly shareBp: number
  readonly attributedChargeMinor: number
}

/**
 * Multi-provider commission rule (8.2 + NEEDS_OWNER_DECISION):
 * - Single provider -> 100% (10,000 bp)
 * - Multiple providers without explicit configured allocations summing to 10,000 bp ->
 *   REFUSED with `COMMISSION_MULTI_PROVIDER_ALLOCATION_REQUIRED`.
 *   Never duplicates 100% per provider and never invents an arbitrary equal split.
 */
export function allocateCommissionShares(input: {
  readonly sessionId: string
  readonly chargedMinor: number
  readonly providerIds: readonly string[]
  readonly allocations?: readonly ProviderAllocation[] | undefined
}): AllocatedCommissionResult[] {
  const uniqueProviders = [...new Set(input.providerIds.filter(Boolean))]
  if (uniqueProviders.length === 0) return []

  if (uniqueProviders.length === 1) {
    return [
      {
        employeeId: uniqueProviders[0]!,
        shareBp: 10_000,
        attributedChargeMinor: input.chargedMinor,
      },
    ]
  }

  const explicit = input.allocations ?? []
  const sumBp = explicit.reduce((acc, a) => acc + a.shareBp, 0)
  const coversAll =
    explicit.length === uniqueProviders.length &&
    uniqueProviders.every((id) => explicit.some((a) => a.employeeId === id)) &&
    sumBp === 10_000

  if (!coversAll) {
    throw new Error('COMMISSION_MULTI_PROVIDER_ALLOCATION_REQUIRED')
  }

  let distributed = 0
  return explicit.map((alloc, index) => {
    const isLast = index === explicit.length - 1
    const share = isLast
      ? input.chargedMinor - distributed
      : Math.round((input.chargedMinor * alloc.shareBp) / 10_000)
    distributed += share
    return {
      employeeId: alloc.employeeId,
      shareBp: alloc.shareBp,
      attributedChargeMinor: share,
    }
  })
}

export interface SalonOperationsSummary {
  readonly totalSessions: number
  readonly scheduledCount: number
  readonly inProgressCount: number
  readonly deliveredCount: number
  readonly noShowCount: number
  readonly cancelledCount: number
  readonly freeCapacityMinutes: number | null
  /** Null whenever any delivered session's charge, material cost, or commission is unknown. */
  readonly serviceProfitMinor: number | null
}

export function summarizeSalonOperations(input: {
  readonly sessions: ReadonlyArray<{
    readonly status: string
    readonly durationMinutes: number
    readonly revenueMinor: number | null
    readonly materialCostMinor: number | null
    readonly commissionMinor: number | null
  }>
  readonly totalAvailableResourceMinutes?: number | null | undefined
}): SalonOperationsSummary {
  let scheduledCount = 0
  let inProgressCount = 0
  let deliveredCount = 0
  let noShowCount = 0
  let cancelledCount = 0
  let occupiedMinutes = 0
  let knownProfitTotal = 0
  let allDeliveredCostsKnown = true

  for (const s of input.sessions) {
    switch (s.status) {
      case 'scheduled':
        scheduledCount += 1
        occupiedMinutes += s.durationMinutes
        break
      case 'in_progress':
        inProgressCount += 1
        occupiedMinutes += s.durationMinutes
        break
      case 'delivered':
        deliveredCount += 1
        occupiedMinutes += s.durationMinutes
        if (s.revenueMinor === null || s.materialCostMinor === null || s.commissionMinor === null) {
          allDeliveredCostsKnown = false
        } else {
          knownProfitTotal += s.revenueMinor - s.materialCostMinor - s.commissionMinor
        }
        break
      case 'no_show':
        noShowCount += 1
        break
      case 'cancelled':
        cancelledCount += 1
        break
    }
  }

  return {
    totalSessions: input.sessions.length,
    scheduledCount,
    inProgressCount,
    deliveredCount,
    noShowCount,
    cancelledCount,
    freeCapacityMinutes:
      input.totalAvailableResourceMinutes != null
        ? Math.max(0, input.totalAvailableResourceMinutes - occupiedMinutes)
        : null,
    serviceProfitMinor: deliveredCount === 0 ? 0 : allDeliveredCostsKnown ? knownProfitTotal : null,
  }
}
