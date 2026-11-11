// ============================================
// packages/validation/src/schemas/contracts.ts
//
// V60 Slice 9 — Contracts, recurring obligations, lease return & SLA rules.
// Deposits are liabilities (`order-deposit.domain.ts`), never early revenue.
// ============================================

import { z } from 'zod'
import { RETURN_CONDITIONS } from './universal-core/returns-settlement.domain'

export const CONTRACT_TYPES = ['service', 'subscription', 'lease', 'maintenance'] as const
export type ContractType = (typeof CONTRACT_TYPES)[number]

export const CONTRACT_STATUSES = ['draft', 'active', 'paused', 'terminated', 'expired'] as const
export type ContractStatus = (typeof CONTRACT_STATUSES)[number]

export const CONTRACT_CADENCES = ['weekly', 'monthly', 'quarterly', 'annual', 'one_off'] as const
export type ContractCadence = (typeof CONTRACT_CADENCES)[number]

export const OBLIGATION_KINDS = ['bill', 'deliver', 'inspect', 'renew'] as const
export type ObligationKind = (typeof OBLIGATION_KINDS)[number]

export const contractCreateSchema = z
  .object({
    customerId: z.string().uuid(),
    contractType: z.enum(CONTRACT_TYPES),
    title: z.string().trim().min(1).max(200),
    currency: z.string().trim().min(3).max(8).optional(),
    amountMinor: z.number().int().min(0),
    depositMinor: z.number().int().min(0).default(0),
    billingCadence: z.enum(CONTRACT_CADENCES),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
    slaResponseHours: z.number().int().positive().nullable().optional(),
    resourceBookingId: z.string().uuid().nullable().optional(),
    serialId: z.string().uuid().nullable().optional(),
  })
  .strict()
export type ContractCreateInput = z.infer<typeof contractCreateSchema>

export const contractBillPeriodSchema = z
  .object({
    periodKey: z.string().trim().min(1).max(40),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict()

export const contractLeaseReturnSchema = z
  .object({
    conditionCode: z.enum(RETURN_CONDITIONS),
    notes: z.string().trim().max(300).optional(),
  })
  .strict()

export const contractSlaBreachSchema = z
  .object({
    reason: z.string().trim().min(1).max(300),
    elapsedHours: z.number().nonnegative(),
  })
  .strict()

export function contractBillIdempotencyKey(contractId: string, periodKey: string): string {
  return `contract:${contractId}:bill:${periodKey}`
}

export function canBillContractPeriod(status: ContractStatus): boolean {
  return status === 'active'
}

export interface SlaEvaluationResult {
  readonly breached: boolean
  readonly code: 'SLA_OK' | 'SLA_BREACHED' | 'SLA_NOT_CONFIGURED'
  readonly penaltyMinor: number | null
}

/**
 * Flags SLA breaches without ever inventing or auto-charging a financial penalty
 * unless an explicit penaltyMinor policy is passed by the owner.
 */
export function evaluateSlaBreach(
  slaResponseHours: number | null | undefined,
  elapsedHours: number,
  explicitPenaltyMinor?: number | null,
): SlaEvaluationResult {
  if (!slaResponseHours || slaResponseHours <= 0) {
    return { breached: false, code: 'SLA_NOT_CONFIGURED', penaltyMinor: null }
  }
  const breached = elapsedHours > slaResponseHours
  return {
    breached,
    code: breached ? 'SLA_BREACHED' : 'SLA_OK',
    penaltyMinor:
      breached && explicitPenaltyMinor !== undefined && explicitPenaltyMinor !== null
        ? explicitPenaltyMinor
        : null,
  }
}
