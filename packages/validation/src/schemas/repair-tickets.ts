// ============================================
// packages/validation/src/schemas/repair-tickets.ts
//
// Mobile shop / repair (QA document §9, P1, 10 Nov 2026): a repair ticket
// and holding a unit for a customer.
//
// A ticket is the paper slip the shop hands the customer: whose device, what
// is wrong, an estimate, who is fixing it, where it stands. It is NOT money:
// the charge is an ordinary sale invoice the ticket points to on delivery
// (the core rule «specialised documents produce an invoice; they do not
// replace the financial core»).
//
// Warranty per unit already exists: public.warranties, one row per sold unit
// (serial number) with its end date. A ticket opened for a unit whose
// warranty has not ended says so — decided on the server from that row,
// never ticked by hand.
// ============================================

import { z } from 'zod'

export const REPAIR_STATUSES = [
  'received',
  'diagnosing',
  'waiting_parts',
  'repairing',
  'ready',
  'delivered',
  'cancelled',
] as const
export type RepairStatus = (typeof REPAIR_STATUSES)[number]

/** Forward moves, plus «back to repairing» when a part arrives. `delivered`/`cancelled` are final. */
export const REPAIR_MOVES: Readonly<Record<RepairStatus, readonly RepairStatus[]>> = {
  received: ['diagnosing', 'repairing', 'cancelled'],
  diagnosing: ['waiting_parts', 'repairing', 'ready', 'cancelled'],
  waiting_parts: ['repairing', 'cancelled'],
  repairing: ['waiting_parts', 'ready', 'cancelled'],
  ready: ['delivered', 'repairing'],
  delivered: [],
  cancelled: [],
}

export function canMoveRepair(from: RepairStatus, to: RepairStatus): boolean {
  return REPAIR_MOVES[from].includes(to)
}

export const TICKET_KINDS = ['repair', 'support'] as const
export type TicketKind = (typeof TICKET_KINDS)[number]

export function isTicketSlaBreached(input: {
  createdAt: string
  closedAt: string | null
  slaHours: number | null | undefined
  now?: Date
}): boolean {
  if (!input.slaHours || input.slaHours <= 0) return false
  const startMs = Date.parse(input.createdAt)
  if (!Number.isFinite(startMs)) return false
  const endMs = input.closedAt ? Date.parse(input.closedAt) : (input.now ?? new Date()).getTime()
  if (!Number.isFinite(endMs)) return false
  return endMs - startMs > input.slaHours * 3_600_000
}

export const repairTicketCreateSchema = z.object({
  customerId: z.string().uuid(),
  ticketKind: z.enum(TICKET_KINDS).optional(),
  slaHours: z.number().int().positive().max(8760).nullable().optional(),
  /** The registered unit (IMEI/serial), when the device is one the shop knows. */
  serialId: z.string().uuid().nullable().optional(),
  /** «Samsung A54, blue» — required: the slip must say which device it is. */
  deviceLabel: z.string().trim().min(1).max(160),
  problem: z.string().trim().min(1).max(1000),
  /** Estimate in minor units of `currency`; both or neither. */
  estimateMinor: z.number().int().nonnegative().max(1e15).nullable().optional(),
  currency: z.string().trim().length(3).nullable().optional(),
  technicianEmployeeId: z.string().uuid().nullable().optional(),
  promisedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
})
export type RepairTicketCreateInput = z.infer<typeof repairTicketCreateSchema>

export const repairTicketMoveSchema = z.object({
  status: z.enum(REPAIR_STATUSES),
  note: z.string().trim().max(500).optional(),
  /** On delivery: the sale invoice that charged for the repair (none for warranty work). */
  invoiceId: z.string().uuid().nullable().optional(),
})
export type RepairTicketMoveInput = z.infer<typeof repairTicketMoveSchema>

export function repairMoveRefusal(
  from: RepairStatus,
  input: RepairTicketMoveInput,
):
  | 'REPAIR_MOVE_NOT_ALLOWED'
  | 'REPAIR_CANCEL_NOTE_REQUIRED'
  | 'REPAIR_INVOICE_ONLY_ON_DELIVERY'
  | null {
  if (!canMoveRepair(from, input.status)) return 'REPAIR_MOVE_NOT_ALLOWED'
  if (input.status === 'cancelled' && !input.note) return 'REPAIR_CANCEL_NOTE_REQUIRED'
  if (input.invoiceId && input.status !== 'delivered') return 'REPAIR_INVOICE_ONLY_ON_DELIVERY'
  return null
}

/** Both or neither: an estimate without its currency is a number nobody can read. */
export function repairEstimateRefusal(
  input: Pick<RepairTicketCreateInput, 'estimateMinor' | 'currency'>,
): 'REPAIR_ESTIMATE_CURRENCY_REQUIRED' | null {
  const hasAmount = input.estimateMinor != null
  const hasCurrency = Boolean(input.currency)
  return hasAmount !== hasCurrency ? 'REPAIR_ESTIMATE_CURRENCY_REQUIRED' : null
}

/**
 * Under warranty on `day` (YYYY-MM-DD, the shop's local day): the unit's
 * warranty (warranties.end_date) ends on or after it. No date = unknown, which is NOT «under
 * warranty» — the slip says «no warranty recorded» instead.
 */
export function warrantyState(
  warrantyEnds: string | null | undefined,
  day: string,
): 'active' | 'expired' | 'unknown' {
  if (!warrantyEnds) return 'unknown'
  return warrantyEnds.slice(0, 10) >= day ? 'active' : 'expired'
}

// ─── The unit itself ─────────────────────────────────────────────────────────

export const serialHoldSchema = z.object({
  /** Hold for this customer; null releases the hold. */
  customerId: z.string().uuid().nullable(),
  /** Optional ISO-8601 expiry timestamp (UTC); null leaves an open-ended hold until released. */
  expiresAt: z.string().datetime().nullable().optional(),
  /** Relative duration in minutes from now (used when expiresAt is not explicitly passed). */
  holdMinutes: z
    .number()
    .int()
    .min(1)
    .max(60 * 24 * 90)
    .nullable()
    .optional(),
})
export type SerialHoldInput = z.infer<typeof serialHoldSchema>

export const serialReturnSchema = z.object({
  conditionCode: z.enum(['sealed', 'opened', 'used', 'damaged', 'defective', 'incomplete']),
  restockChoice: z.enum(['restock', 'scrap']).optional(),
  returnNumber: z.string().trim().min(1).max(80).optional(),
  returnDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  reasonCode: z
    .enum([
      'defective',
      'wrong_item',
      'customer_change_of_mind',
      'damaged_in_transit',
      'expired',
      'other',
    ])
    .optional(),
  notes: z.string().trim().max(500).optional(),
  refundMethod: z.enum(['cash', 'bank']).optional(),
  refundAmount: z.number().positive().optional(),
})
export type SerialReturnInput = z.infer<typeof serialReturnSchema>

export const repairPartReserveSchema = z.object({
  warehouseId: z.string().uuid(),
  productId: z.string().uuid(),
  quantity: z.number().positive(),
  unitPriceMinor: z.number().int().nonnegative().max(1e15).optional(),
  currency: z.string().trim().length(3).optional(),
  customerApproved: z.boolean().optional(),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
})
export type RepairPartReserveInput = z.infer<typeof repairPartReserveSchema>

export const repairBillCreateSchema = z.object({
  warehouseId: z.string().uuid().optional(),
  laborFeeMinor: z.number().int().nonnegative().max(1e15).optional(),
  laborProductId: z.string().uuid().optional(),
  paymentMethod: z.enum(['cash', 'bank', 'credit']).optional(),
  paidAmount: z.number().nonnegative().optional(),
  markDelivered: z.boolean().optional(),
})
export type RepairBillCreateInput = z.infer<typeof repairBillCreateSchema>

// ─── Display-stage mapping, parts gating, and repair billing split (W5 §8.4) ─

export type RepairDisplayStage =
  | 'received'
  | 'awaiting_diagnosis'
  | 'awaiting_customer_approval'
  | 'awaiting_part'
  | 'repairing'
  | 'testing'
  | 'ready'
  | 'delivered'
  | 'cancelled'

/** Preserves the Postgres status enum while mapping business display stages. */
export function repairDisplayStage(
  status: RepairStatus,
  options?: {
    readonly customerApproved?: boolean | undefined
    readonly testing?: boolean | undefined
  },
): RepairDisplayStage {
  switch (status) {
    case 'received':
      return 'received'
    case 'diagnosing':
      return options?.customerApproved === false
        ? 'awaiting_customer_approval'
        : 'awaiting_diagnosis'
    case 'waiting_parts':
      return 'awaiting_part'
    case 'repairing':
      return options?.testing ? 'testing' : 'repairing'
    case 'ready':
      return 'ready'
    case 'delivered':
      return 'delivered'
    case 'cancelled':
      return 'cancelled'
  }
}

/** Parts may only be reserved/consumed once ticket is diagnosed/repairing and never after close. */
export function canConsumePartsOnRepair(input: {
  readonly status: RepairStatus
  readonly customerApproved: boolean
}): {
  readonly allowed: boolean
  readonly reason?: 'REPAIR_APPROVAL_REQUIRED' | 'REPAIR_TICKET_CLOSED'
} {
  if (input.status === 'delivered' || input.status === 'cancelled') {
    return { allowed: false, reason: 'REPAIR_TICKET_CLOSED' }
  }
  if (!input.customerApproved) {
    return { allowed: false, reason: 'REPAIR_APPROVAL_REQUIRED' }
  }
  if (input.status === 'received') {
    return { allowed: false, reason: 'REPAIR_APPROVAL_REQUIRED' }
  }
  return { allowed: true }
}

/** Produces the canonical V58 ATP reservation request scoped to a repair ticket. */
export function repairPartReservationInput(input: {
  readonly ticketId: string
  readonly warehouseId: string
  readonly productId: string
  readonly quantity: number
  readonly idempotencyKey: string
}) {
  return {
    warehouseId: input.warehouseId,
    productId: input.productId,
    quantity: input.quantity,
    referenceType: 'repair_ticket',
    referenceId: input.ticketId,
    idempotencyKey: input.idempotencyKey,
  }
}

export interface RepairInvoiceSplit {
  readonly partsRevenueMinor: number
  readonly laborRevenueMinor: number
  readonly totalRevenueMinor: number
}

/** Separates spare-part revenue (goods) from repair labor (service) on a repair invoice. */
export function splitRepairInvoiceRevenue(
  lines: ReadonlyArray<{
    readonly offeringType: 'goods' | 'service' | 'package'
    readonly lineTotalMinor: number
  }>,
): RepairInvoiceSplit {
  let partsRevenueMinor = 0
  let laborRevenueMinor = 0
  for (const line of lines) {
    if (line.offeringType === 'service') laborRevenueMinor += line.lineTotalMinor
    else partsRevenueMinor += line.lineTotalMinor
  }
  return {
    partsRevenueMinor,
    laborRevenueMinor,
    totalRevenueMinor: partsRevenueMinor + laborRevenueMinor,
  }
}

export interface RepairMetricsSummary {
  readonly openTickets: number
  readonly waitingPartsTickets: number
  readonly deliveredTickets: number
  readonly underWarrantyTickets: number
  /** Mean turnaround hours for closed delivered tickets; null when none are closed. */
  readonly meanRepairHours: number | null
}

export function summarizeRepairMetrics(
  tickets: ReadonlyArray<{
    readonly status: RepairStatus
    readonly underWarranty: boolean
    readonly createdAt: string
    readonly closedAt: string | null
  }>,
): RepairMetricsSummary {
  let openTickets = 0
  let waitingPartsTickets = 0
  let deliveredTickets = 0
  let underWarrantyTickets = 0
  let turnaroundHoursSum = 0
  let closedWithTimes = 0

  for (const t of tickets) {
    if (t.status !== 'delivered' && t.status !== 'cancelled') openTickets += 1
    if (t.status === 'waiting_parts') waitingPartsTickets += 1
    if (t.status === 'delivered') {
      deliveredTickets += 1
      if (t.closedAt) {
        const ms = Date.parse(t.closedAt) - Date.parse(t.createdAt)
        if (Number.isFinite(ms) && ms >= 0) {
          turnaroundHoursSum += ms / 3_600_000
          closedWithTimes += 1
        }
      }
    }
    if (t.underWarranty) underWarrantyTickets += 1
  }

  return {
    openTickets,
    waitingPartsTickets,
    deliveredTickets,
    underWarrantyTickets,
    meanRepairHours:
      closedWithTimes > 0 ? Math.round((turnaroundHoursSum / closedWithTimes) * 100) / 100 : null,
  }
}
