// ============================================
// packages/validation/src/schemas/universal-core/table-service.domain.ts
//
// WP-10 — TABLE SERVICE on the SHARED sales-order core.
//
// A table is not a second order engine: it is a label on a sales order plus a
// rule that prevents two open orders owning the same seat at the same time.
// Order status transitions still come from `isValidSalesOrderTransition`; this
// module only adds the occupancy decision and the KDS stage of each line.
// ============================================

import type { OrderStatus } from '../developer.schema'

export type TableOrderStage = 'ordered' | 'preparing' | 'ready' | 'served' | 'cancelled'

export const TABLE_ORDER_TRANSITIONS: Readonly<
  Record<TableOrderStage, readonly TableOrderStage[]>
> = {
  ordered: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['served', 'cancelled'],
  served: [],
  cancelled: [],
}

export function canMoveTableOrder(from: TableOrderStage, to: TableOrderStage): boolean {
  return TABLE_ORDER_TRANSITIONS[from].includes(to)
}

/**
 * A seat is free only when no other OPEN order holds it. `confirmed` and the
 * in-service statuses hold the table; `cancelled`/`fulfilled` release it.
 */
export function tableIsOccupied(
  orders: readonly { tableId: string; status: OrderStatus }[],
  tableId: string,
): boolean {
  const holding: readonly OrderStatus[] = [
    'quoted',
    'pending',
    'confirmed',
    'partially_fulfilled',
    'invoiced',
    'paid',
  ]
  return orders.some((o) => o.tableId === tableId && holding.includes(o.status))
}

/** A table order may only enter the kitchen when its parent order is ALREADY confirmed. */
export function canSendToKitchen(orderStatus: OrderStatus): boolean {
  return orderStatus === 'confirmed' || orderStatus === 'partially_fulfilled'
}

/**
 * Split a bill across seats WITHOUT inventing a total: every seat amount is a
 * given minor amount, and the sum must equal the passed total or the split is
 * rejected (null). The caller never guesses a missing seat amount.
 */
export function splitTableBill(
  totalMinor: number,
  seatAmountsMinor: readonly number[],
): number[] | null {
  if (!Number.isSafeInteger(totalMinor) || totalMinor < 0 || seatAmountsMinor.length === 0)
    return null
  if (seatAmountsMinor.some((a) => !Number.isSafeInteger(a) || a < 0)) return null
  const sum = seatAmountsMinor.reduce((a, b) => a + b, 0)
  return sum === totalMinor ? [...seatAmountsMinor] : null
}

// ─── G04 / G05: Tips, Tip Pooling & Service Charge ───────────────────────────

export function computeServiceChargeAndTip(
  subtotalMinor: number,
  serviceChargeBps: number,
  tipMinor: number,
): { serviceChargeMinor: number; tipMinor: number; grandTotalMinor: number } {
  const safeSub = Math.max(0, Math.trunc(subtotalMinor))
  const safeBps = Math.max(0, Math.min(5000, Math.trunc(serviceChargeBps)))
  const safeTip = Math.max(0, Math.trunc(tipMinor))
  const serviceChargeMinor = Math.round((safeSub * safeBps) / 10_000)
  return {
    serviceChargeMinor,
    tipMinor: safeTip,
    grandTotalMinor: safeSub + serviceChargeMinor + safeTip,
  }
}

export function poolTipsEqually(
  totalTipMinor: number,
  staffIds: readonly string[],
): Record<string, number> {
  if (staffIds.length === 0 || totalTipMinor <= 0) return {}
  const base = Math.floor(totalTipMinor / staffIds.length)
  let rem = totalTipMinor - base * staffIds.length
  const out: Record<string, number> = {}
  for (const id of staffIds) {
    out[id] = base + (rem > 0 ? 1 : 0)
    if (rem > 0) rem -= 1
  }
  return out
}

// ─── G68 / G69: Class/Resource Capacity & Waitlist ───────────────────────────

export function allocateCapacityOrWaitlist(
  capacity: number,
  confirmedIds: readonly string[],
  waitlistIds: readonly string[],
  applicantId: string,
): {
  status: 'confirmed' | 'waitlisted' | 'already_present'
  confirmedIds: string[]
  waitlistIds: string[]
} {
  if (confirmedIds.includes(applicantId) || waitlistIds.includes(applicantId)) {
    return {
      status: 'already_present',
      confirmedIds: [...confirmedIds],
      waitlistIds: [...waitlistIds],
    }
  }
  if (confirmedIds.length < capacity) {
    return {
      status: 'confirmed',
      confirmedIds: [...confirmedIds, applicantId],
      waitlistIds: [...waitlistIds],
    }
  }
  return {
    status: 'waitlisted',
    confirmedIds: [...confirmedIds],
    waitlistIds: [...waitlistIds, applicantId],
  }
}
