// ============================================
// packages/validation/src/schemas/universal-core/package-credit-ledger.domain.ts
//
// M3 — PACKAGE CREDIT & ENTITLEMENT LEDGER
// Universal Domain Model for Prepaid Packages, Service Credits, and Entitlements
//
// Invariants:
// 1. Three Distinct Truths:
//    - Package Credit/Entitlement Truth: append-only ledger of physical/service facts
//    - Payment Truth: cash received/due, handled strictly by existing payment engine
//    - Accounting Truth: double-entry ledger, handled strictly by existing double-entry engine
// 2. Immutable Ledger Facts: GRANT, CONSUME, REVERSAL, EXPIRE, ADJUSTMENT
// 3. Derived Balance: Remaining = Grants + Adjustments + Reversals - Consumes - Expirations
// 4. Fail-closed on Over-Consumption: Cannot consume more credits than remaining balance
// 5. Expiration Separates Entitlement from Money: Expiring credits zeroes remaining entitlement
//    without creating a cash refund or modifying past invoice revenue.
// 6. Zero Duplication: Runs identical pure domain logic across Web, Windows, Android.
// ============================================

import { z } from 'zod'

export const PACKAGE_CREDIT_ENTRY_TYPES = [
  'GRANT',
  'CONSUME',
  'REVERSAL',
  'EXPIRE',
  'ADJUSTMENT',
] as const

export type PackageCreditEntryType = (typeof PACKAGE_CREDIT_ENTRY_TYPES)[number]

export const packageCreditEntryTypeSchema = z.enum(PACKAGE_CREDIT_ENTRY_TYPES)

export interface PackageCreditEntry {
  readonly id: string
  readonly workspaceId: string
  readonly customerId: string
  readonly packageProductId: string
  readonly entryType: PackageCreditEntryType
  readonly quantity: number
  readonly unit?: string | null | undefined
  readonly sourceDocumentType?:
    'invoice' | 'service_delivery' | 'manual' | 'cancellation' | 'expiration' | string | undefined
  readonly sourceDocumentId?: string | null | undefined
  readonly sourceLineId?: string | null | undefined
  readonly referenceEntryId?: string | null | undefined
  readonly idempotencyKey?: string | null | undefined
  readonly notes?: string | null | undefined
  readonly expiresAt?: string | null | undefined
  readonly effectiveDate: string
  readonly createdAt: string
  readonly updatedAt?: string | undefined
  readonly [key: string]: unknown
}

export const packageCreditEntrySchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  customerId: z.string(),
  packageProductId: z.string(),
  entryType: packageCreditEntryTypeSchema,
  quantity: z.number(),
  unit: z.string().optional().nullable(),
  sourceDocumentType: z.string().optional().nullable(),
  sourceDocumentId: z.string().optional().nullable(),
  sourceLineId: z.string().optional().nullable(),
  referenceEntryId: z.string().optional().nullable(),
  idempotencyKey: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  expiresAt: z.string().optional().nullable(),
  effectiveDate: z.string(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
})

/**
 * Filter entries for a specific customer and package product account.
 */
export function filterEntriesForAccount(
  entries: readonly PackageCreditEntry[],
  customerId: string,
  packageProductId: string,
): PackageCreditEntry[] {
  return entries.filter(
    (e) => e.customerId === customerId && e.packageProductId === packageProductId,
  )
}

/**
 * Derives current available credit balance from an append-only sequence of ledger entries.
 * Formula: Remaining = Grants + Adjustments + Reversals - Consumes - Expirations
 */
export function derivePackageBalance(entries: readonly PackageCreditEntry[]): number {
  let balance = 0
  for (const entry of entries) {
    switch (entry.entryType) {
      case 'GRANT':
        balance += entry.quantity
        break
      case 'CONSUME':
        balance -= entry.quantity
        break
      case 'REVERSAL':
        balance += entry.quantity
        break
      case 'EXPIRE':
        balance -= entry.quantity
        break
      case 'ADJUSTMENT':
        balance += entry.quantity
        break
    }
  }
  // Balance cannot be negative under sound invariant; return rounded to 4 decimals for fractional units
  return Math.round(balance * 10000) / 10000
}

/**
 * Returns true if requested credit quantity can be consumed from current balance.
 */
export function canConsumeCredit(currentBalance: number, requestedQuantity: number): boolean {
  if (requestedQuantity <= 0) return false
  return currentBalance >= requestedQuantity
}

export interface PlanConsumptionParams {
  readonly entries: readonly PackageCreditEntry[]
  readonly workspaceId: string
  readonly customerId: string
  readonly packageProductId: string
  readonly quantity: number
  readonly unit?: string | null | undefined
  readonly sourceDocumentType?: string | undefined
  readonly sourceDocumentId?: string | null | undefined
  readonly sourceLineId?: string | null | undefined
  readonly idempotencyKey?: string | null | undefined
  readonly notes?: string | null | undefined
  readonly effectiveDate?: string | undefined
}

export interface PlanConsumptionResult {
  readonly entry: PackageCreditEntry
  readonly newBalance: number
}

/**
 * Plans a package consumption entry.
 * - Idempotent: If idempotencyKey exists for a CONSUME entry, returns existing entry without double-decrementing.
 * - Fail-closed: Throws INSUFFICIENT_PACKAGE_CREDIT if balance < requestedQuantity.
 */
export function planPackageConsumption(params: PlanConsumptionParams): PlanConsumptionResult {
  const {
    entries,
    workspaceId,
    customerId,
    packageProductId,
    quantity,
    unit,
    sourceDocumentType = 'service_delivery',
    sourceDocumentId,
    sourceLineId,
    idempotencyKey,
    notes,
    effectiveDate = new Date().toISOString().slice(0, 10),
  } = params

  if (quantity <= 0) {
    throw new Error('PACKAGE_CONSUME_QUANTITY_MUST_BE_POSITIVE')
  }

  // Idempotency check: if already processed with this key, return existing entry
  if (idempotencyKey) {
    const existing = entries.find(
      (e) =>
        e.idempotencyKey === idempotencyKey &&
        e.customerId === customerId &&
        e.packageProductId === packageProductId &&
        e.entryType === 'CONSUME',
    )
    if (existing) {
      const currentBalance = derivePackageBalance(
        filterEntriesForAccount(entries, customerId, packageProductId),
      )
      return { entry: existing, newBalance: currentBalance }
    }
  }

  const accountEntries = filterEntriesForAccount(entries, customerId, packageProductId)
  const currentBalance = derivePackageBalance(accountEntries)

  if (!canConsumeCredit(currentBalance, quantity)) {
    throw new Error('INSUFFICIENT_PACKAGE_CREDIT')
  }

  const entry: PackageCreditEntry = {
    id: `pce_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    workspaceId,
    customerId,
    packageProductId,
    entryType: 'CONSUME',
    quantity,
    unit: unit || null,
    sourceDocumentType,
    sourceDocumentId: sourceDocumentId || null,
    sourceLineId: sourceLineId || null,
    referenceEntryId: null,
    idempotencyKey: idempotencyKey || null,
    notes: notes || null,
    effectiveDate,
    createdAt: new Date().toISOString(),
  }

  const newBalance = Math.round((currentBalance - quantity) * 10000) / 10000
  return { entry, newBalance }
}

export interface PlanReversalParams {
  readonly entries: readonly PackageCreditEntry[]
  readonly referenceEntryId: string
  readonly quantity?: number | undefined
  readonly idempotencyKey?: string | null | undefined
  readonly notes?: string | null | undefined
  readonly effectiveDate?: string | undefined
}

export interface PlanReversalResult {
  readonly entry: PackageCreditEntry
  readonly newBalance: number
}

/**
 * Plans a package credit reversal for a previously consumed session/unit.
 * - Restores credits up to the consumed amount.
 * - Prevents double-reversal.
 */
export function planPackageReversal(params: PlanReversalParams): PlanReversalResult {
  const {
    entries,
    referenceEntryId,
    quantity,
    idempotencyKey,
    notes,
    effectiveDate = new Date().toISOString().slice(0, 10),
  } = params

  const targetEntry = entries.find((e) => e.id === referenceEntryId)
  if (!targetEntry) {
    throw new Error('REFERENCE_ENTRY_NOT_FOUND')
  }

  if (targetEntry.entryType !== 'CONSUME') {
    throw new Error('CANNOT_REVERSE_NON_CONSUMPTION_ENTRY')
  }

  // Calculate already reversed amount for this consume entry
  const priorReversals = entries.filter(
    (e) => e.entryType === 'REVERSAL' && e.referenceEntryId === referenceEntryId,
  )
  const totalReversedSoFar = priorReversals.reduce((sum, r) => sum + r.quantity, 0)
  const maxReversible = targetEntry.quantity - totalReversedSoFar

  const revQuantity = quantity ?? maxReversible
  if (revQuantity <= 0 || revQuantity > maxReversible) {
    throw new Error('REVERSAL_EXCEEDS_CONSUMED_QUANTITY')
  }

  const entry: PackageCreditEntry = {
    id: `pce_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    workspaceId: targetEntry.workspaceId,
    customerId: targetEntry.customerId,
    packageProductId: targetEntry.packageProductId,
    entryType: 'REVERSAL',
    quantity: revQuantity,
    unit: targetEntry.unit || null,
    sourceDocumentType: 'cancellation',
    sourceDocumentId: targetEntry.sourceDocumentId || null,
    sourceLineId: targetEntry.sourceLineId || null,
    referenceEntryId: targetEntry.id,
    idempotencyKey: idempotencyKey || null,
    notes: notes || null,
    effectiveDate,
    createdAt: new Date().toISOString(),
  }

  const accountEntries = filterEntriesForAccount(
    entries,
    targetEntry.customerId,
    targetEntry.packageProductId,
  )
  const currentBalance = derivePackageBalance(accountEntries)
  const newBalance = Math.round((currentBalance + revQuantity) * 10000) / 10000

  return { entry, newBalance }
}

export interface PlanExpirationParams {
  readonly entries: readonly PackageCreditEntry[]
  readonly workspaceId: string
  readonly customerId: string
  readonly packageProductId: string
  readonly idempotencyKey?: string | null | undefined
  readonly notes?: string | null | undefined
  readonly effectiveDate?: string | undefined
}

export interface PlanExpirationResult {
  readonly entry: PackageCreditEntry | null
  readonly newBalance: number
}

/**
 * Plans package expiration.
 * - Strictly zeroes remaining entitlement.
 * - Does NOT create cash refund or touch payment/accounting ledger (truth separation).
 */
export function planPackageExpiration(params: PlanExpirationParams): PlanExpirationResult {
  const {
    entries,
    workspaceId,
    customerId,
    packageProductId,
    idempotencyKey,
    notes,
    effectiveDate = new Date().toISOString().slice(0, 10),
  } = params

  const accountEntries = filterEntriesForAccount(entries, customerId, packageProductId)
  const currentBalance = derivePackageBalance(accountEntries)

  if (currentBalance <= 0) {
    return { entry: null, newBalance: 0 }
  }

  const entry: PackageCreditEntry = {
    id: `pce_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    workspaceId,
    customerId,
    packageProductId,
    entryType: 'EXPIRE',
    quantity: currentBalance,
    unit: accountEntries[0]?.unit || null,
    sourceDocumentType: 'expiration',
    sourceDocumentId: null,
    sourceLineId: null,
    referenceEntryId: null,
    idempotencyKey: idempotencyKey || null,
    notes: notes || null,
    effectiveDate,
    createdAt: new Date().toISOString(),
  }

  return { entry, newBalance: 0 }
}

export interface PlanAdjustmentParams {
  readonly entries: readonly PackageCreditEntry[]
  readonly workspaceId: string
  readonly customerId: string
  readonly packageProductId: string
  readonly quantityDelta: number
  readonly unit?: string | null | undefined
  readonly idempotencyKey?: string | null | undefined
  readonly notes?: string | null | undefined
  readonly effectiveDate?: string | undefined
}

export interface PlanAdjustmentResult {
  readonly entry: PackageCreditEntry
  readonly newBalance: number
}

/**
 * Plans managerial adjustment to package credit balance.
 */
export function planPackageAdjustment(params: PlanAdjustmentParams): PlanAdjustmentResult {
  const {
    entries,
    workspaceId,
    customerId,
    packageProductId,
    quantityDelta,
    unit,
    idempotencyKey,
    notes,
    effectiveDate = new Date().toISOString().slice(0, 10),
  } = params

  const accountEntries = filterEntriesForAccount(entries, customerId, packageProductId)
  const currentBalance = derivePackageBalance(accountEntries)
  const newBalance = Math.round((currentBalance + quantityDelta) * 10000) / 10000

  if (newBalance < 0) {
    throw new Error('INSUFFICIENT_PACKAGE_CREDIT')
  }

  const entry: PackageCreditEntry = {
    id: `pce_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    workspaceId,
    customerId,
    packageProductId,
    entryType: 'ADJUSTMENT',
    quantity: quantityDelta,
    unit: unit || null,
    sourceDocumentType: 'manual',
    sourceDocumentId: null,
    sourceLineId: null,
    referenceEntryId: null,
    idempotencyKey: idempotencyKey || null,
    notes: notes || null,
    effectiveDate,
    createdAt: new Date().toISOString(),
  }

  return { entry, newBalance }
}

export interface PlanGrantParams {
  readonly workspaceId: string
  readonly customerId: string
  readonly packageProductId: string
  readonly quantity: number
  readonly unit?: string | null | undefined
  readonly sourceDocumentType?: string | undefined
  readonly sourceDocumentId?: string | null | undefined
  readonly sourceLineId?: string | null | undefined
  readonly idempotencyKey?: string | null | undefined
  readonly notes?: string | null | undefined
  readonly expiresAt?: string | null | undefined
  readonly effectiveDate?: string | undefined
}

/**
 * Plans a package credit GRANT entry (e.g. from invoice creation).
 */
export function planPackageGrant(params: PlanGrantParams): PackageCreditEntry {
  const {
    workspaceId,
    customerId,
    packageProductId,
    quantity,
    unit,
    sourceDocumentType = 'invoice',
    sourceDocumentId,
    sourceLineId,
    idempotencyKey,
    notes,
    expiresAt,
    effectiveDate = new Date().toISOString().slice(0, 10),
  } = params

  if (quantity <= 0) {
    throw new Error('GRANT_QUANTITY_MUST_BE_POSITIVE')
  }

  return {
    id: `pce_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    workspaceId,
    customerId,
    packageProductId,
    entryType: 'GRANT',
    quantity,
    unit: unit || null,
    sourceDocumentType,
    sourceDocumentId: sourceDocumentId || null,
    sourceLineId: sourceLineId || null,
    referenceEntryId: null,
    idempotencyKey: idempotencyKey || null,
    notes: notes || null,
    expiresAt: expiresAt || null,
    effectiveDate,
    createdAt: new Date().toISOString(),
  }
}
