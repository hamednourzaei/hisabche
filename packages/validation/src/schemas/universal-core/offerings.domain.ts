// ============================================
// packages/validation/src/schemas/universal-core/offerings.domain.ts
//
// Universal Offering Model & Inventory Movement Rules
// (M2.1 - Shared Offering and Mixed Commerce)
// ============================================

import { z } from 'zod'

export const OFFERING_TYPES = ['goods', 'service', 'package'] as const
export type OfferingType = (typeof OFFERING_TYPES)[number]

export const offeringTypeSchema = z.enum(OFFERING_TYPES).default('goods')

/**
 * Returns true if this offering moves physical warehouse inventory and
 * participates in cost layer consumption (FIFO/AVCO).
 *
 * Goods move stock and consume cost layers.
 * Services and packages NEVER move physical stock or draw from cost layers.
 * Null/undefined/legacy defaults to true (goods) for backward compatibility.
 */
export function movesStock(offeringType: OfferingType | string | null | undefined): boolean {
  if (!offeringType) return true
  return offeringType === 'goods'
}

/**
 * Returns true if this offering represents an intangible service.
 */
export function isServiceOffering(offeringType: OfferingType | string | null | undefined): boolean {
  return offeringType === 'service'
}

/**
 * Returns true if this offering represents a prepaid bundle/package.
 */
export function isPackageOffering(offeringType: OfferingType | string | null | undefined): boolean {
  return offeringType === 'package'
}

/**
 * Asserts whether package credit ledger operations can be performed.
 * In M2.x, credit ledger operations are strictly scheduled for M3.
 * Any attempt to draw or consume package credit prior to M3 must fail loudly.
 */
export function assertCreditLedgerAvailable(
  offeringType: OfferingType | string | null | undefined,
): void {
  if (offeringType === 'package') {
    throw new Error('PACKAGE_CREDIT_LEDGER_UNAVAILABLE_UNTIL_M3')
  }
}
