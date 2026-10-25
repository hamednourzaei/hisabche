// ============================================
// packages/local-engine/src/routes/installments.ts
//
// Installment plans (#123) and late fees (#124) on the device.
//
// NO RULE LIVES HERE. The plan the invoice page reads (`buildInstallmentPlan`),
// the split (`planInstallments`), the late-fee state/overdue/chargeable rule
// (`buildLateFeePreview`, `planLateFeeAssessment`) are @hisabche/validation —
// the very functions the server's `InstallmentService` / `LateFeeService` call.
// This file reads SQLite rows into them and writes the result back.
//
// ⚠️ A SCHEDULE, NOT A PAYMENT. The plan records when money was agreed to
// arrive; how much of each part is paid is derived from what the invoice still
// owes. Nothing here touches the payment path.
//
// ⚠️ A LATE FEE IS AN ORDINARY SALE INVOICE, issued through the engine's own
// `POST /invoices` (found on the router, not re-implemented), with an id
// derived from (invoice, installment, period): the assessment row is written
// first, the invoice second, and a retry finds the invoice already there.
// ============================================

import {
  buildInstallmentPlan,
  buildLateFeePreview,
  createInvoiceSchema,
  FEE_LINE,
  fromHundredths,
  lateFeePolicySchema,
  LATE_FEE_LANGUAGES,
  minor,
  outstandingHundredths,
  planInstallments,
  planLateFeeAssessment,
  type LateFeeAssessmentRow,
  type LateFeeInvoiceFacts,
  type LateFeeLanguage,
  type LateFeePolicy,
  type LateFeePreview,
} from '@hisabche/validation'
import { z } from 'zod'
import type { LocalDb } from '../db'
import { NotFoundError, ValidationError } from '../errors'
import type { Router } from '../router'
import type { LocalContext, RouteHandlerContext } from '../types'
import { derivedId } from './derived-id'

const today = () => new Date().toISOString().slice(0, 10)
const major = fromHundredths

interface InvoiceRowLite {
  id: string
  invoice_number: string | null
  type: string
  status: string
  customer_id: string | null
  currency: string
  due_date: string | null
  total: number
  paid_amount: number
}

function invoiceOf(db: LocalDb, ctx: LocalContext, invoiceId: string): InvoiceRowLite {
  const row = db.get<InvoiceRowLite>(
    `SELECT id, invoice_number, type, status, customer_id, currency, due_date, total, paid_amount
     FROM invoice WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`,
    [invoiceId, ctx.workspaceId],
  )
  if (!row) throw new NotFoundError('Invoice', invoiceId)
  return row
}

/** What the invoice still owes, in the hundredths a plan is kept in. */
const owedHundredths = (row: InvoiceRowLite) =>
  outstandingHundredths(Number(row.total) - Number(row.paid_amount))

function planOf(db: LocalDb, ctx: LocalContext, row: InvoiceRowLite) {
  const rows = db.all<{ seq: number; due_date: string; amount_minor: number }>(
    `SELECT seq, due_date, amount_minor FROM invoice_installment
     WHERE workspace_id = ? AND invoice_id = ? ORDER BY seq ASC`,
    [ctx.workspaceId, row.id],
  )
  return buildInstallmentPlan({
    invoiceId: row.id,
    currency: row.currency,
    outstandingHundredths: owedHundredths(row),
    rows,
    asOf: today(),
  })
}

// ─── Late-fee policy and assessments ─────────────────────────────

interface PolicyRow {
  is_enabled: number
  basis: 'per_period' | 'percentage'
  amount_minor: number | null
  currency: string | null
  percent: number | null
  grace_days: number
  max_share_percent: number
  updated_at: string
}

function policyOf(db: LocalDb, ctx: LocalContext): LateFeePolicy | null {
  const row = db.get<PolicyRow>(
    `SELECT is_enabled, basis, amount_minor, currency, percent, grace_days, max_share_percent, updated_at
     FROM late_fee_policy WHERE workspace_id = ?`,
    [ctx.workspaceId],
  )
  if (!row) return null
  return {
    isEnabled: Boolean(row.is_enabled),
    basis: row.basis,
    amount: row.amount_minor === null ? null : major(row.amount_minor),
    currency: row.currency,
    percent: row.percent === null ? null : Number(row.percent),
    graceDays: row.grace_days,
    maxSharePercent: Number(row.max_share_percent),
    updatedAt: row.updated_at,
  }
}

function previewOf(db: LocalDb, ctx: LocalContext, invoiceId: string): LateFeePreview {
  const row = invoiceOf(db, ctx, invoiceId)
  const facts: LateFeeInvoiceFacts = {
    id: row.id,
    invoiceNumber: row.invoice_number ?? '',
    type: row.type,
    status: row.status,
    customerId: row.customer_id,
    currency: row.currency,
    dueDate: row.due_date ? String(row.due_date).slice(0, 10) : null,
    totalMinor: minor(Number(row.total) || 0),
    allocatedMinor: minor(Number(row.paid_amount) || 0),
  }
  const assessments = db.all<LateFeeAssessmentRow>(
    `SELECT id, seq, period_no, due_date, days_late, overdue_minor, fee_minor, currency,
            fee_invoice_id, assessed_at
     FROM late_fee_assessment WHERE workspace_id = ? AND invoice_id = ? ORDER BY assessed_at ASC`,
    [ctx.workspaceId, invoiceId],
  )
  const isFeeInvoice =
    (db.get<{ n: number }>(
      'SELECT COUNT(*) AS n FROM late_fee_assessment WHERE workspace_id = ? AND fee_invoice_id = ?',
      [ctx.workspaceId, invoiceId],
    )?.n ?? 0) > 0
  return buildLateFeePreview({
    invoice: facts,
    policy: policyOf(db, ctx),
    assessments,
    plannedLines: planOf(db, ctx, row).lines,
    isFeeInvoice,
    asOf: today(),
  })
}

export function registerInstallmentRoutes(router: Router): void {
  // ─── Installments ──────────────────────────────────────────
  router.get('/invoices/:id/installments', (c: RouteHandlerContext) => {
    return planOf(c.db, c.ctx, invoiceOf(c.db, c.ctx, c.params.id ?? ''))
  })

  router.put('/invoices/:id/installments', (c: RouteHandlerContext) => {
    const parsed = z
      .object({
        // A single payment is not a plan; five years of months is the ceiling.
        count: z.number().int().min(2).max(60),
        firstDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .safeParse(c.body ?? {})
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0]?.message ?? 'Validation failed')
    }
    const row = invoiceOf(c.db, c.ctx, c.params.id ?? '')
    const planned = planInstallments(owedHundredths(row), parsed.data)
    if ('refusal' in planned) throw new ValidationError(planned.refusal)

    const now = new Date().toISOString()
    c.db.transaction(() => {
      c.db.run('DELETE FROM invoice_installment WHERE workspace_id = ? AND invoice_id = ?', [
        c.ctx.workspaceId,
        row.id,
      ])
      for (const line of planned.lines) {
        c.db.run(
          `INSERT INTO invoice_installment
             (id, workspace_id, invoice_id, seq, due_date, amount_minor, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            derivedId(c.ctx.workspaceId, 'installment', row.id, String(line.seq)),
            c.ctx.workspaceId,
            row.id,
            line.seq,
            line.dueDate,
            line.amountMinor,
            c.ctx.userId,
            now,
            now,
          ],
        )
      }
    })
    return planOf(c.db, c.ctx, row)
  })

  router.delete('/invoices/:id/installments', (c: RouteHandlerContext) => {
    const row = invoiceOf(c.db, c.ctx, c.params.id ?? '')
    c.db.run('DELETE FROM invoice_installment WHERE workspace_id = ? AND invoice_id = ?', [
      c.ctx.workspaceId,
      row.id,
    ])
    return planOf(c.db, c.ctx, row)
  })

  // ─── Late fees ─────────────────────────────────────────────
  router.get('/late-fees/policy', (c: RouteHandlerContext) => ({
    policy: policyOf(c.db, c.ctx),
  }))

  router.put('/late-fees/policy', (c: RouteHandlerContext) => {
    const parsed = lateFeePolicySchema.safeParse(c.body ?? {})
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0]?.message ?? 'Validation failed')
    }
    const input = parsed.data
    const fixed = input.basis === 'per_period'
    const amountMinor = fixed ? minor(input.amount ?? 0) : null
    // 0.004 is a positive number and zero hundredths.
    if (fixed && !(amountMinor! > 0)) throw new ValidationError('LATE_FEE_AMOUNT_REQUIRED')

    c.db.run(
      `INSERT INTO late_fee_policy
         (workspace_id, is_enabled, basis, amount_minor, currency, percent, grace_days,
          max_share_percent, updated_by, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(workspace_id) DO UPDATE SET
         is_enabled = excluded.is_enabled, basis = excluded.basis,
         amount_minor = excluded.amount_minor, currency = excluded.currency,
         percent = excluded.percent, grace_days = excluded.grace_days,
         max_share_percent = excluded.max_share_percent, updated_by = excluded.updated_by,
         updated_at = excluded.updated_at`,
      [
        c.ctx.workspaceId,
        input.isEnabled ? 1 : 0,
        input.basis,
        // Each basis keeps only its own fields, whatever was sent with it.
        amountMinor,
        fixed ? input.currency!.toUpperCase() : null,
        fixed ? null : input.percent,
        input.graceDays,
        input.maxSharePercent,
        c.ctx.userId,
        new Date().toISOString(),
      ],
    )
    return { policy: policyOf(c.db, c.ctx) }
  })

  router.get('/invoices/:id/late-fees', (c: RouteHandlerContext) =>
    previewOf(c.db, c.ctx, c.params.id ?? ''),
  )

  router.post('/invoices/:id/late-fees', async (c: RouteHandlerContext) => {
    const language: LateFeeLanguage = z
      .object({ language: z.enum(LATE_FEE_LANGUAGES).default('fa') })
      .parse(c.body ?? {}).language
    const invoiceId = c.params.id ?? ''

    const work = planLateFeeAssessment(previewOf(c.db, c.ctx, invoiceId))
    if ('refusal' in work) throw new ValidationError(work.refusal)
    const invoice = invoiceOf(c.db, c.ctx, invoiceId)
    const policy = policyOf(c.db, c.ctx)!
    const create = router.find('POST', '/invoices')
    if (!create) throw new Error('the engine has no invoice route')

    // The fee is an ordinary sale invoice, through the engine's own route.
    const issue = async (assessment: {
      id: string
      seq: number
      periodNo: number
      feeMinor: number
    }) => {
      const fee = major(assessment.feeMinor)
      const body = createInvoiceSchema.parse({
        type: 'sale',
        date: `${today()}T00:00:00.000Z`,
        customerId: invoice.customer_id,
        currency: invoice.currency,
        items: [
          {
            productName: FEE_LINE[language](invoice.invoice_number ?? '', assessment.seq),
            quantity: 1,
            unitPrice: fee,
            totalPrice: fee,
          },
        ],
        subtotal: fee,
        total: fee,
        paidAmount: 0,
        reference: invoice.invoice_number ?? '',
      })
      // The same id for the same (invoice, installment, period), always: a retried
      // call finds the invoice the first attempt created.
      const feeInvoiceId = derivedId(
        c.ctx.workspaceId,
        'late_fee',
        invoiceId,
        String(assessment.seq),
        String(assessment.periodNo),
      )
      const exists = c.db.get<{ id: string }>('SELECT id FROM invoice WHERE id = ?', [feeInvoiceId])
      if (!exists) {
        await create.handler({
          db: c.db,
          ctx: c.ctx,
          params: {},
          query: {},
          body: { ...body, id: feeInvoiceId },
          headers: {},
        })
      }
      c.db.run(
        `UPDATE late_fee_assessment SET fee_invoice_id = ?
         WHERE workspace_id = ? AND id = ? AND fee_invoice_id IS NULL`,
        [feeInvoiceId, c.ctx.workspaceId, assessment.id],
      )
    }

    for (const row of work.unfinished) await issue(row)

    for (const line of work.chargeable) {
      const id = derivedId(
        c.ctx.workspaceId,
        'late_fee_assessment',
        invoiceId,
        String(line.seq),
        String(line.periodNo),
      )
      const taken = c.db.get<{ id: string }>(
        `SELECT id FROM late_fee_assessment
         WHERE workspace_id = ? AND invoice_id = ? AND seq = ? AND period_no = ?`,
        [c.ctx.workspaceId, invoiceId, line.seq, line.periodNo],
      )
      // This period is already charged: that one stands.
      if (taken) continue
      c.db.run(
        `INSERT INTO late_fee_assessment
           (id, workspace_id, invoice_id, seq, period_no, due_date, days_late, overdue_minor,
            fee_minor, currency, policy, assessed_by, assessed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          c.ctx.workspaceId,
          invoiceId,
          line.seq,
          line.periodNo,
          line.dueDate,
          line.daysLate,
          line.overdueMinor,
          line.feeMinor,
          invoice.currency,
          JSON.stringify(policy),
          c.ctx.userId,
          new Date().toISOString(),
        ],
      )
      await issue({ id, seq: line.seq, periodNo: line.periodNo, feeMinor: line.feeMinor })
    }

    // The server answers 200 here (it charges, it does not create a resource).
    return { __status: 200, __data: previewOf(c.db, c.ctx, invoiceId) }
  })
}
