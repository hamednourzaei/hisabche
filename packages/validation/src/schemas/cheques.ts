import { z } from 'zod'

export const CHEQUE_STATUSES = [
  'received',
  'issued',
  'deposited',
  'endorsed',
  'cleared',
  'bounced',
  'cancelled',
] as const

export type ChequeStatus = (typeof CHEQUE_STATUSES)[number]

export const createChequeSchema = z.object({
  direction: z.enum(['in', 'out']),
  cheque_number: z.string().min(1).max(80),
  bank_name: z.string().max(120).optional(),
  due_date: z.string().min(8).max(32),
  amount_minor: z.number().int().positive(),
  currency: z.string().min(3).max(8),
  payment_id: z.string().uuid().optional(),
  note: z.string().max(400).optional(),
})

export const transitionChequeSchema = z.object({
  status: z.enum(CHEQUE_STATUSES),
  endorsed_to_supplier_id: z.string().uuid().optional(),
  note: z.string().max(400).optional(),
})

const CHEQUE_TRANSITIONS: Record<ChequeStatus, readonly ChequeStatus[]> = {
  received: ['deposited', 'endorsed', 'cancelled'],
  issued: ['cleared', 'bounced', 'cancelled'],
  deposited: ['cleared', 'bounced'],
  endorsed: ['cleared', 'bounced'],
  cleared: [],
  bounced: [],
  cancelled: [],
}

export function canTransitionCheque(
  fromStatus: ChequeStatus,
  toStatus: ChequeStatus,
  direction: 'in' | 'out',
): { ok: true } | { ok: false; code: string } {
  if (fromStatus === 'endorsed' && toStatus === 'deposited') {
    return { ok: false, code: 'CHEQUE_ENDORSED_CANNOT_DEPOSIT' }
  }
  if (direction === 'out' && (toStatus === 'deposited' || toStatus === 'endorsed')) {
    return { ok: false, code: 'CHEQUE_DIRECTION_INVALID_FOR_TRANSITION' }
  }
  const allowed = CHEQUE_TRANSITIONS[fromStatus] ?? []
  if (!allowed.includes(toStatus)) {
    return { ok: false, code: 'CHEQUE_ILLEGAL_TRANSITION' }
  }
  return { ok: true }
}
