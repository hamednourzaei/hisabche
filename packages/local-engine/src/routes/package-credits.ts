// ============================================
// packages/local-engine/src/routes/package-credits.ts
//
// M3 — PACKAGE CREDIT & ENTITLEMENT LEDGER
// Local Engine handlers for Package Credit & Entitlement Ledger
// ============================================

import {
  derivePackageBalance,
  filterEntriesForAccount,
  planPackageAdjustment,
  planPackageConsumption,
  planPackageExpiration,
  planPackageReversal,
  type PackageCreditEntry,
  type PackageCreditEntryType,
} from '@hisabche/validation'
import { buildEnqueue } from '@hisabche/app-bridge'
import { requireCapability } from '../auth'
import { ValidationError } from '../errors'
import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'

interface PackageCreditLedgerRow {
  id: string
  workspace_id: string
  customer_id: string
  package_product_id: string
  entry_type: string
  quantity: number
  unit: string | null
  source_document_type: string | null
  source_document_id: string | null
  source_line_id: string | null
  reference_entry_id: string | null
  idempotency_key: string | null
  notes: string | null
  expires_at: string | null
  effective_date: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

function rowToEntry(row: PackageCreditLedgerRow): PackageCreditEntry {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    customerId: row.customer_id,
    packageProductId: row.package_product_id,
    entryType: row.entry_type as PackageCreditEntryType,
    quantity: Number(row.quantity),
    unit: row.unit,
    sourceDocumentType: row.source_document_type || undefined,
    sourceDocumentId: row.source_document_id,
    sourceLineId: row.source_line_id,
    referenceEntryId: row.reference_entry_id,
    idempotencyKey: row.idempotency_key,
    notes: row.notes,
    expiresAt: row.expires_at,
    effectiveDate: row.effective_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function registerPackageCreditsRoutes(router: Router): void {
  // ─── 1. Get Balance ──────────────────────────────────────────────
  router.get('/package-credits/balance', async (c: RouteHandlerContext) => {
    const { db, ctx, query } = c
    const customerId = query.customerId
    const packageProductId = query.packageProductId

    if (!customerId) {
      throw new ValidationError('customerId is required')
    }

    if (packageProductId) {
      const rows = db.all<PackageCreditLedgerRow>(
        `SELECT * FROM package_credit_ledger
         WHERE workspace_id = ? AND customer_id = ? AND package_product_id = ? AND deleted_at IS NULL
         ORDER BY effective_date ASC, created_at ASC`,
        [ctx.workspaceId, customerId, packageProductId],
      )
      const entries = rows.map(rowToEntry)
      const balance = derivePackageBalance(entries)
      return {
        customerId,
        packageProductId,
        balance,
      }
    }

    // All packages for this customer
    const rows = db.all<PackageCreditLedgerRow>(
      `SELECT * FROM package_credit_ledger
       WHERE workspace_id = ? AND customer_id = ? AND deleted_at IS NULL
       ORDER BY effective_date ASC, created_at ASC`,
      [ctx.workspaceId, customerId],
    )
    const entries = rows.map(rowToEntry)

    const packages = [...new Set(entries.map((e) => e.packageProductId))]
    const balances = packages.map((pkgId) => ({
      packageProductId: pkgId,
      balance: derivePackageBalance(filterEntriesForAccount(entries, customerId, pkgId)),
    }))

    return {
      customerId,
      balances,
    }
  })

  // ─── 2. Get Ledger Entries ───────────────────────────────────────
  router.get('/package-credits/ledger', async (c: RouteHandlerContext) => {
    const { db, ctx, query } = c
    const customerId = query.customerId
    const packageProductId = query.packageProductId

    let sql = `SELECT * FROM package_credit_ledger WHERE workspace_id = ? AND deleted_at IS NULL`
    const params: unknown[] = [ctx.workspaceId]

    if (customerId) {
      sql += ' AND customer_id = ?'
      params.push(customerId)
    }
    if (packageProductId) {
      sql += ' AND package_product_id = ?'
      params.push(packageProductId)
    }

    sql += ' ORDER BY effective_date ASC, created_at ASC'
    const rows = db.all<PackageCreditLedgerRow>(sql, params)

    return rows.map(rowToEntry)
  })

  // ─── 3. Consume Package Credit ───────────────────────────────────
  router.post('/package-credits/consume', async (c: RouteHandlerContext) => {
    const { db, ctx, body } = c
    requireCapability(ctx, 'invoice.create')

    const payload = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
    const customerId = typeof payload.customerId === 'string' ? payload.customerId : ''
    const packageProductId =
      typeof payload.packageProductId === 'string' ? payload.packageProductId : ''
    const quantity = Number(payload.quantity)

    if (!customerId || !packageProductId || isNaN(quantity) || quantity <= 0) {
      throw new ValidationError('customerId, packageProductId, and positive quantity are required')
    }

    const rows = db.all<PackageCreditLedgerRow>(
      `SELECT * FROM package_credit_ledger
       WHERE workspace_id = ? AND customer_id = ? AND package_product_id = ? AND deleted_at IS NULL
       ORDER BY effective_date ASC, created_at ASC`,
      [ctx.workspaceId, customerId, packageProductId],
    )
    const entries = rows.map(rowToEntry)

    let plan: ReturnType<typeof planPackageConsumption>
    try {
      plan = planPackageConsumption({
        entries,
        workspaceId: ctx.workspaceId,
        customerId,
        packageProductId,
        quantity,
        unit: typeof payload.unit === 'string' ? payload.unit : undefined,
        sourceDocumentType:
          typeof payload.sourceDocumentType === 'string'
            ? payload.sourceDocumentType
            : 'service_delivery',
        sourceDocumentId:
          typeof payload.sourceDocumentId === 'string' ? payload.sourceDocumentId : undefined,
        sourceLineId: typeof payload.sourceLineId === 'string' ? payload.sourceLineId : undefined,
        idempotencyKey:
          typeof payload.idempotencyKey === 'string' ? payload.idempotencyKey : undefined,
        notes: typeof payload.notes === 'string' ? payload.notes : undefined,
        effectiveDate:
          typeof payload.effectiveDate === 'string' ? payload.effectiveDate : undefined,
      })
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        (err.message === 'INSUFFICIENT_PACKAGE_CREDIT' ||
          err.message === 'PACKAGE_CONSUME_QUANTITY_MUST_BE_POSITIVE')
      ) {
        throw new ValidationError(err.message)
      }
      throw err
    }

    // Check if this was an idempotent return of an already existing row
    const existing = rows.find((r) => r.id === plan.entry.id)
    if (existing) {
      return {
        __status: 200,
        __data: {
          entry: plan.entry,
          balance: plan.newBalance,
        },
      }
    }

    const now = new Date().toISOString()
    db.run(
      `INSERT INTO package_credit_ledger (
        id, workspace_id, customer_id, package_product_id, entry_type, quantity,
        unit, source_document_type, source_document_id, source_line_id, reference_entry_id,
        idempotency_key, notes, effective_date, created_at, updated_at, origin, sync_state
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'local', 'local_only')`,
      [
        plan.entry.id,
        ctx.workspaceId,
        customerId,
        packageProductId,
        plan.entry.entryType,
        plan.entry.quantity,
        plan.entry.unit || null,
        plan.entry.sourceDocumentType || null,
        plan.entry.sourceDocumentId || null,
        plan.entry.sourceLineId || null,
        null,
        plan.entry.idempotencyKey || null,
        plan.entry.notes || null,
        plan.entry.effectiveDate,
        plan.entry.createdAt,
        now,
      ],
    )

    if (c.headers?.['x-hisabche-queue'] === '1') {
      const eq = buildEnqueue({
        entity: 'package_credit_ledger',
        operation: 'create',
        clientId: plan.entry.id,
        payload: plan.entry,
        userId: ctx.userId ?? null,
        workspaceId: ctx.workspaceId,
      })
      db.run(eq.sql, eq.params)
    }

    return {
      entry: plan.entry,
      balance: plan.newBalance,
    }
  })

  // ─── 4. Reverse Consumption ──────────────────────────────────────
  router.post('/package-credits/reverse', async (c: RouteHandlerContext) => {
    const { db, ctx, body } = c
    requireCapability(ctx, 'invoice.create')

    const payload = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
    const referenceEntryId =
      typeof payload.referenceEntryId === 'string' ? payload.referenceEntryId : ''
    if (!referenceEntryId) {
      throw new ValidationError('referenceEntryId is required')
    }

    const rows = db.all<PackageCreditLedgerRow>(
      `SELECT * FROM package_credit_ledger
       WHERE workspace_id = ? AND deleted_at IS NULL
       ORDER BY effective_date ASC, created_at ASC`,
      [ctx.workspaceId],
    )
    const entries = rows.map(rowToEntry)

    let plan: ReturnType<typeof planPackageReversal>
    try {
      plan = planPackageReversal({
        entries,
        referenceEntryId,
        quantity: payload.quantity !== undefined ? Number(payload.quantity) : undefined,
        idempotencyKey:
          typeof payload.idempotencyKey === 'string' ? payload.idempotencyKey : undefined,
        notes: typeof payload.notes === 'string' ? payload.notes : undefined,
        effectiveDate:
          typeof payload.effectiveDate === 'string' ? payload.effectiveDate : undefined,
      })
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        (err.message === 'REFERENCE_ENTRY_NOT_FOUND' ||
          err.message === 'CANNOT_REVERSE_NON_CONSUMPTION_ENTRY' ||
          err.message === 'REVERSAL_EXCEEDS_CONSUMED_QUANTITY')
      ) {
        throw new ValidationError(err.message)
      }
      throw err
    }

    const now = new Date().toISOString()
    db.run(
      `INSERT INTO package_credit_ledger (
        id, workspace_id, customer_id, package_product_id, entry_type, quantity,
        unit, source_document_type, source_document_id, source_line_id, reference_entry_id,
        idempotency_key, notes, effective_date, created_at, updated_at, origin, sync_state
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'local', 'local_only')`,
      [
        plan.entry.id,
        ctx.workspaceId,
        plan.entry.customerId,
        plan.entry.packageProductId,
        plan.entry.entryType,
        plan.entry.quantity,
        plan.entry.unit || null,
        plan.entry.sourceDocumentType || null,
        plan.entry.sourceDocumentId || null,
        plan.entry.sourceLineId || null,
        plan.entry.referenceEntryId,
        plan.entry.idempotencyKey || null,
        plan.entry.notes || null,
        plan.entry.effectiveDate,
        plan.entry.createdAt,
        now,
      ],
    )

    if (c.headers?.['x-hisabche-queue'] === '1') {
      const eq = buildEnqueue({
        entity: 'package_credit_ledger',
        operation: 'create',
        clientId: plan.entry.id,
        payload: plan.entry,
        userId: ctx.userId ?? null,
        workspaceId: ctx.workspaceId,
      })
      db.run(eq.sql, eq.params)
    }

    return {
      entry: plan.entry,
      balance: plan.newBalance,
    }
  })

  // ─── 5. Expire Unused Credits ────────────────────────────────────
  router.post('/package-credits/expire', async (c: RouteHandlerContext) => {
    const { db, ctx, body } = c
    requireCapability(ctx, 'invoice.create')

    const payload = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
    const customerId = typeof payload.customerId === 'string' ? payload.customerId : ''
    const packageProductId =
      typeof payload.packageProductId === 'string' ? payload.packageProductId : ''

    if (!customerId || !packageProductId) {
      throw new ValidationError('customerId and packageProductId are required')
    }

    const rows = db.all<PackageCreditLedgerRow>(
      `SELECT * FROM package_credit_ledger
       WHERE workspace_id = ? AND customer_id = ? AND package_product_id = ? AND deleted_at IS NULL
       ORDER BY effective_date ASC, created_at ASC`,
      [ctx.workspaceId, customerId, packageProductId],
    )
    const entries = rows.map(rowToEntry)

    const plan = planPackageExpiration({
      entries,
      workspaceId: ctx.workspaceId,
      customerId,
      packageProductId,
      idempotencyKey:
        typeof payload.idempotencyKey === 'string' ? payload.idempotencyKey : undefined,
      notes: typeof payload.notes === 'string' ? payload.notes : undefined,
      effectiveDate: typeof payload.effectiveDate === 'string' ? payload.effectiveDate : undefined,
    })

    if (plan.entry) {
      const now = new Date().toISOString()
      db.run(
        `INSERT INTO package_credit_ledger (
          id, workspace_id, customer_id, package_product_id, entry_type, quantity,
          unit, source_document_type, source_document_id, source_line_id, reference_entry_id,
          idempotency_key, notes, effective_date, created_at, updated_at, origin, sync_state
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'local', 'local_only')`,
        [
          plan.entry.id,
          ctx.workspaceId,
          customerId,
          packageProductId,
          plan.entry.entryType,
          plan.entry.quantity,
          plan.entry.unit || null,
          plan.entry.sourceDocumentType || null,
          null,
          null,
          null,
          plan.entry.idempotencyKey || null,
          plan.entry.notes || null,
          plan.entry.effectiveDate,
          plan.entry.createdAt,
          now,
        ],
      )

      if (c.headers?.['x-hisabche-queue'] === '1') {
        const eq = buildEnqueue({
          entity: 'package_credit_ledger',
          operation: 'create',
          clientId: plan.entry.id,
          payload: plan.entry,
          userId: ctx.userId ?? null,
          workspaceId: ctx.workspaceId,
        })
        db.run(eq.sql, eq.params)
      }
    }

    return {
      __status: 200,
      __data: {
        entry: plan.entry,
        balance: 0,
      },
    }
  })

  // ─── 6. Adjust Credits ───────────────────────────────────────────
  router.post('/package-credits/adjust', async (c: RouteHandlerContext) => {
    const { db, ctx, body } = c
    requireCapability(ctx, 'invoice.create')

    const payload = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
    const customerId = typeof payload.customerId === 'string' ? payload.customerId : ''
    const packageProductId =
      typeof payload.packageProductId === 'string' ? payload.packageProductId : ''
    const quantityDelta = Number(payload.quantityDelta)

    if (!customerId || !packageProductId || isNaN(quantityDelta)) {
      throw new ValidationError('customerId, packageProductId, and quantityDelta are required')
    }

    const rows = db.all<PackageCreditLedgerRow>(
      `SELECT * FROM package_credit_ledger
       WHERE workspace_id = ? AND customer_id = ? AND package_product_id = ? AND deleted_at IS NULL
       ORDER BY effective_date ASC, created_at ASC`,
      [ctx.workspaceId, customerId, packageProductId],
    )
    const entries = rows.map(rowToEntry)

    let plan: ReturnType<typeof planPackageAdjustment>
    try {
      plan = planPackageAdjustment({
        entries,
        workspaceId: ctx.workspaceId,
        customerId,
        packageProductId,
        quantityDelta,
        unit: typeof payload.unit === 'string' ? payload.unit : undefined,
        idempotencyKey:
          typeof payload.idempotencyKey === 'string' ? payload.idempotencyKey : undefined,
        notes: typeof payload.notes === 'string' ? payload.notes : undefined,
        effectiveDate:
          typeof payload.effectiveDate === 'string' ? payload.effectiveDate : undefined,
      })
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'INSUFFICIENT_PACKAGE_CREDIT') {
        throw new ValidationError(err.message)
      }
      throw err
    }

    const now = new Date().toISOString()
    db.run(
      `INSERT INTO package_credit_ledger (
        id, workspace_id, customer_id, package_product_id, entry_type, quantity,
        unit, source_document_type, source_document_id, source_line_id, reference_entry_id,
        idempotency_key, notes, effective_date, created_at, updated_at, origin, sync_state
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'local', 'local_only')`,
      [
        plan.entry.id,
        ctx.workspaceId,
        customerId,
        packageProductId,
        plan.entry.entryType,
        plan.entry.quantity,
        plan.entry.unit || null,
        plan.entry.sourceDocumentType || null,
        null,
        null,
        null,
        plan.entry.idempotencyKey || null,
        plan.entry.notes || null,
        plan.entry.effectiveDate,
        plan.entry.createdAt,
        now,
      ],
    )

    if (c.headers?.['x-hisabche-queue'] === '1') {
      const eq = buildEnqueue({
        entity: 'package_credit_ledger',
        operation: 'create',
        clientId: plan.entry.id,
        payload: plan.entry,
        userId: ctx.userId ?? null,
        workspaceId: ctx.workspaceId,
      })
      db.run(eq.sql, eq.params)
    }

    return {
      entry: plan.entry,
      balance: plan.newBalance,
    }
  })
}
