// ============================================
// packages/local-engine/src/routes/contracts.ts
//
// WP-17 — OFFLINE RECURRING CONTRACTS.
//
// The device records a contract and PROPOSES a billable period with a stable
// idempotency key. It never issues an invoice or posts money: the server owns
// the binding bill through /api/contracts/:id/bill. Shared rules decide whether
// a period is billable and the key that makes a repeat bill a no-op.
// ============================================

import {
  canBillContractPeriod,
  contractBillIdempotencyKey,
  type ContractCadence,
  type ContractStatus,
  type ContractType,
} from '@hisabche/validation'
import { requireCapability } from '../auth'
import { ConflictError, NotFoundError, ValidationError } from '../errors'
import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'

const TYPES: readonly string[] = ['service', 'subscription', 'lease', 'maintenance']
const CADENCES: readonly string[] = ['weekly', 'monthly', 'quarterly', 'annual', 'one_off']

function uuid(): string {
  return crypto.randomUUID()
}

function trim(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function registerContractRoutes(router: Router): void {
  router.get('/local-contracts', (c: RouteHandlerContext) => {
    return {
      data: c.db.all(
        `SELECT * FROM local_contracts WHERE workspace_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`,
        [c.ctx.workspaceId],
      ),
    }
  })

  router.get('/local-contracts/:id', (c: RouteHandlerContext) => {
    const row = c.db.get(
      `SELECT * FROM local_contracts WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`,
      [c.params.id, c.ctx.workspaceId],
    )
    if (!row) throw new NotFoundError('Contract', c.params.id ?? '')
    return row
  })

  router.post('/local-contracts', (c: RouteHandlerContext) => {
    requireCapability(c.ctx, 'invoice.create')
    const raw = (c.body || {}) as Record<string, unknown>
    const customerId = trim(raw.customerId)
    const title = trim(raw.title)
    const contractType = trim(raw.contractType).toLowerCase()
    const cadence = trim(raw.cadence).toLowerCase()
    const currency = trim(raw.currency).toUpperCase()
    const amountMinor = Number(raw.amountMinor)
    if (
      !customerId ||
      !title ||
      !TYPES.includes(contractType) ||
      !CADENCES.includes(cadence) ||
      !/^[A-Z]{3}$/.test(currency) ||
      !Number.isSafeInteger(amountMinor) ||
      amountMinor < 0
    ) {
      throw new ValidationError('CONTRACT_INPUT_INVALID')
    }
    const id = trim(raw.id) || uuid()
    const now = new Date().toISOString()
    c.db.run(
      `INSERT INTO local_contracts
        (id, workspace_id, customer_id, title, contract_type, cadence, status, amount_minor,
         currency, kyc_note, created_at, updated_at, origin, sync_state)
       VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, 'local', 'local_only')`,
      [
        id,
        c.ctx.workspaceId,
        customerId,
        title,
        contractType as ContractType,
        cadence as ContractCadence,
        amountMinor,
        currency,
        trim(raw.kycNote) || null,
        now,
        now,
      ],
    )
    return {
      __status: 201,
      __data: c.db.get('SELECT * FROM local_contracts WHERE id = ?', [id]),
    }
  })

  // Activate — the only status that allows a bill, decided by the shared rule.
  router.post('/local-contracts/:id/activate', (c: RouteHandlerContext) => {
    requireCapability(c.ctx, 'invoice.create')
    const row = c.db.get<{ id: string; status: string }>(
      `SELECT id, status FROM local_contracts WHERE id = ? AND workspace_id = ?`,
      [c.params.id, c.ctx.workspaceId],
    )
    if (!row) throw new NotFoundError('Contract', c.params.id ?? '')
    if (row.status !== 'draft') throw new ConflictError('CONTRACT_TRANSITION_NOT_ALLOWED')
    const now = new Date().toISOString()
    c.db.run(
      `UPDATE local_contracts SET status = 'active', updated_at = ? WHERE id = ? AND workspace_id = ?`,
      [now, row.id, c.ctx.workspaceId],
    )
    return { id: row.id, status: 'active' as ContractStatus }
  })

  // Propose a billable period. Idempotent by the shared contract bill key;
  // the invoice itself is still issued by the server.
  router.post('/local-contracts/:id/bill-period', (c: RouteHandlerContext) => {
    requireCapability(c.ctx, 'invoice.create')
    const contract = c.db.get<{ id: string; status: string }>(
      `SELECT id, status FROM local_contracts WHERE id = ? AND workspace_id = ?`,
      [c.params.id, c.ctx.workspaceId],
    )
    if (!contract) throw new NotFoundError('Contract', c.params.id ?? '')
    if (!canBillContractPeriod(contract.status as ContractStatus)) {
      throw new ConflictError('CONTRACT_NOT_BILLABLE')
    }
    const raw = (c.body || {}) as Record<string, unknown>
    const periodKey = trim(raw.periodKey)
    if (!periodKey) throw new ValidationError('PERIOD_KEY_REQUIRED')
    const key = contractBillIdempotencyKey(contract.id, periodKey)

    return c.db.transaction(() => {
      const existing = c.db.get(
        `SELECT * FROM local_contract_bills WHERE workspace_id = ? AND idempotency_key = ?`,
        [c.ctx.workspaceId, key],
      )
      if (existing) return { __status: 200, __data: { ...existing, alreadyProposed: true } }
      const now = new Date().toISOString()
      const id = uuid()
      c.db.run(
        `INSERT INTO local_contract_bills
          (id, workspace_id, contract_id, period_key, idempotency_key, status, invoice_id, created_at)
         VALUES (?, ?, ?, ?, ?, 'proposed', NULL, ?)`,
        [id, c.ctx.workspaceId, contract.id, periodKey, key, now],
      )
      return {
        __status: 201,
        __data: {
          id,
          contractId: contract.id,
          periodKey,
          idempotencyKey: key,
          status: 'proposed',
          invoiceId: null,
          alreadyProposed: false,
        },
      }
    })
  })
}
