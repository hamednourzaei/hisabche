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

export const repairTicketCreateSchema = z.object({
  customerId: z.string().uuid(),
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
})
export type SerialHoldInput = z.infer<typeof serialHoldSchema>
