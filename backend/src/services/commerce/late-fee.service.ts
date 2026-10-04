// ============================================
// backend/src/services/commerce/late-fee.service.ts
//
// Capability #124 — late payment fees.
//
// The RULE is the installment domain's (`overdueInstallments`): a fee is worked
// out on what is OVERDUE, not on the whole invoice; a paid installment is never
// late; a cap limits it. This file reads the rows, asks the rule, and — only
// when a manager says so — charges.
//
// ⚠️ NOTHING IS CHARGED AUTOMATICALLY. There is no job. `preview` shows what
// could be charged; `assess` is a person's decision.
//
// ⚠️ THE FEE IS AN ORDINARY SALE INVOICE, issued through `InvoiceService.create`
// — the same function every sale uses. The receivable and the ledger entry are
// that invoice's. Nothing here writes a journal line, a balance or a payment.
//
// ⚠️ CHARGED ONCE. An assessment row is written FIRST, under a unique index on
// (invoice, installment, period); the invoice is issued second with a key
// derived from that same triple. A double click, a retry, and a crash between
// the two steps all end with one row and one invoice: a row whose invoice was
// not issued is finished by the next call, never repeated.
//
// ⚠️ THE POLICY IS SNAPSHOTTED on each assessment, so a fee stays explainable
// after the policy changes.
//
// ⚠️ NO FEE ON A FEE. An invoice that is itself a late fee is never assessed.
// ============================================

import {
  createInvoiceSchema,
  lateFeePolicySchema,
  LATE_FEE_PERIOD_DAYS,
  type CreateInvoice,
  type LateFeePolicy,
} from '@hisabche/validation'

import { supabase } from '../../db'
import { BaseError } from '../../errors/base.error'
import { DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { sourceIdOf } from '../../utils/deterministic-id'
import { minor } from '../../utils/money'
import { InvoiceService } from '../invoice.service'
import type { TenancyContext } from '../tenancy.service'
import {
  overdueInstallments,
  type InstallmentSchedule,
  type LateFeeSettings,
} from './installment.domain'
import { InstallmentsNotConfiguredError, installmentService } from './installment.service'

const MISSING_SCHEMA = new Set(['42703', '42P01', 'PGRST204', 'PGRST205'])
const POLICY_COLUMNS =
  'is_enabled, basis, amount_minor, currency, percent, grace_days, max_share_percent, updated_at'
const ASSESSMENT_COLUMNS =
  'id, seq, period_no, due_date, days_late, overdue_minor, fee_minor, currency, fee_invoice_id, assessed_at'

export class LateFeesNotConfiguredError extends BaseError {
  constructor() {
    super('LATE_FEES_MIGRATION_PENDING', 503)
    this.name = 'LateFeesNotConfiguredError'
  }
}

type DbError = { code?: string; message: string }

function fail(error: DbError, what: string): never {
  if (MISSING_SCHEMA.has(error.code ?? '')) throw new LateFeesNotConfiguredError()
  throw new DatabaseError(what, error)
}

/** Why nothing can be charged on this invoice — or `ready`. */
export type LateFeeState =
  | 'ready'
  | 'off'
  | 'other_currency'
  | 'not_sale'
  | 'cancelled'
  | 'no_customer'
  | 'no_due_date'
  | 'fee_invoice'

export const LATE_FEE_LANGUAGES = ['fa', 'af', 'en'] as const
export type LateFeeLanguage = (typeof LATE_FEE_LANGUAGES)[number]

/** The line written on the fee invoice. A stored document, so it has a language. */
const FEE_LINE: Record<LateFeeLanguage, (invoiceNumber: string, seq: number) => string> = {
  fa: (n, seq) =>
    seq > 0 ? `جریمه‌ی دیرکرد فاکتور ${n} — قسط ${seq}` : `جریمه‌ی دیرکرد فاکتور ${n}`,
  af: (n, seq) => (seq > 0 ? `جریمه‌ی تأخیر بل ${n} — قسط ${seq}` : `جریمه‌ی تأخیر بل ${n}`),
  en: (n, seq) =>
    seq > 0 ? `Late fee on invoice ${n} — installment ${seq}` : `Late fee on invoice ${n}`,
}

export interface LateFeeLine {
  /** The installment; 0 = the invoice as a whole (it has no plan). */
  seq: number
  dueDate: string
  daysLate: number
  /** Major units of the invoice's currency, like every amount below. */
  overdue: number
  /** What the policy asks for in total, as of today. */
  fee: number
  /** What has already been charged for this line. */
  assessed: number
  /** What a manager can charge now. */
  toAssess: number
  /** True when the cap limited the fee. */
  capped: boolean
}

export interface LateFeeAssessment {
  id: string
  seq: number
  periodNo: number
  dueDate: string
  daysLate: number
  overdue: number
  fee: number
  assessedAt: string
  /** Null while the fee invoice has not been issued yet. */
  feeInvoiceId: string | null
}

export interface LateFeePreview {
  invoiceId: string
  invoiceNumber: string
  currency: string
  state: LateFeeState
  policy: LateFeePolicy | null
  lines: LateFeeLine[]
  totalToAssess: number
  assessments: LateFeeAssessment[]
}

interface AssessmentRow {
  id: string
  seq: number
  period_no: number
  due_date: string
  days_late: number
  overdue_minor: number | string
  fee_minor: number | string
  currency: string
  fee_invoice_id: string | null
  assessed_at: string
}

interface InvoiceFacts {
  id: string
  invoiceNumber: string
  type: string
  status: string
  customerId: string | null
  currency: string
  dueDate: string | null
  totalMinor: number
  allocatedMinor: number
}

const today = () => new Date().toISOString().slice(0, 10)
const major = (hundredths: number | string) => Number(hundredths) / 100

/**
 * The domain's settings for an invoice in `currency`, or why there are none.
 *
 * ⚠️ A fixed amount in another currency is LEFT OUT, not converted.
 */
export function settingsFor(
  policy: LateFeePolicy | null,
  currency: string,
): { settings: LateFeeSettings } | { state: 'off' | 'other_currency' } {
  if (!policy || !policy.isEnabled) return { state: 'off' }
  if (policy.basis === 'per_period') {
    if (policy.currency !== currency) return { state: 'other_currency' }
    return {
      settings: {
        basis: 'per_period',
        value: minor(policy.amount ?? 0),
        graceDays: policy.graceDays,
        maxShareOfOverduePercent: policy.maxSharePercent,
      },
    }
  }
  return {
    settings: {
      basis: 'percentage',
      value: policy.percent ?? 0,
      graceDays: policy.graceDays,
      maxShareOfOverduePercent: policy.maxSharePercent,
    },
  }
}

/** Which period an assessment made today belongs to. A percentage is charged once: 0. */
export function periodOf(policy: LateFeePolicy, daysLate: number): number {
  return policy.basis === 'per_period' ? Math.floor(daysLate / LATE_FEE_PERIOD_DAYS) : 0
}

/**
 * What may be charged now on one line, in hundredths.
 *
 * A period already assessed is never assessed again — whatever the policy has
 * become since. Otherwise it is what the policy asks for in total, less what
 * has been charged.
 */
export function chargeableMinor(
  policy: LateFeePolicy,
  line: { daysLate: number; feeMinor: number },
  assessed: readonly { periodNo: number; feeMinor: number }[],
): number {
  if (assessed.some((row) => row.periodNo === periodOf(policy, line.daysLate))) return 0
  const already = assessed.reduce((sum, row) => sum + row.feeMinor, 0)
  return Math.max(0, line.feeMinor - already)
}

export interface LateFeeInvoiceCreator {
  create: InvoiceService['create']
}

export class LateFeeService {
  constructor(private readonly invoices: LateFeeInvoiceCreator = new InvoiceService()) {}

  // ─── Policy ────────────────────────────────────────────────────────────────

  /** The saved policy, or null when the business has never set one (= no fee). */
  async policy(ctx: TenancyContext): Promise<LateFeePolicy | null> {
    const { data, error } = await supabase
      .from('late_fee_policies')
      .select(POLICY_COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .maybeSingle()
    if (error) fail(error, 'Failed to read the late fee policy')
    if (!data) return null
    const row = data as {
      is_enabled: boolean
      basis: 'per_period' | 'percentage'
      amount_minor: number | string | null
      currency: string | null
      percent: number | string | null
      grace_days: number
      max_share_percent: number | string
      updated_at: string
    }
    return {
      isEnabled: row.is_enabled,
      basis: row.basis,
      amount: row.amount_minor === null ? null : major(row.amount_minor),
      currency: row.currency,
      percent: row.percent === null ? null : Number(row.percent),
      graceDays: row.grace_days,
      maxSharePercent: Number(row.max_share_percent),
      updatedAt: row.updated_at,
    }
  }

  async savePolicy(ctx: TenancyContext, raw: unknown): Promise<LateFeePolicy> {
    const input = lateFeePolicySchema.parse(raw)
    const fixed = input.basis === 'per_period'
    const amountMinor = fixed ? minor(input.amount ?? 0) : null
    // 0.004 is a positive number and zero hundredths.
    if (fixed && !(amountMinor! > 0)) throw new ValidationError('LATE_FEE_AMOUNT_REQUIRED')

    const { error } = await supabase.from('late_fee_policies').upsert(
      {
        workspace_id: ctx.workspaceId,
        is_enabled: input.isEnabled,
        basis: input.basis,
        // Each basis keeps only its own fields, whatever was sent with it.
        amount_minor: amountMinor,
        currency: fixed ? input.currency!.toUpperCase() : null,
        percent: fixed ? null : input.percent,
        grace_days: input.graceDays,
        max_share_percent: input.maxSharePercent,
        updated_by: ctx.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'workspace_id' },
    )
    if (error) fail(error, 'Failed to save the late fee policy')
    const saved = await this.policy(ctx)
    if (!saved) throw new DatabaseError('Failed to read the late fee policy back', {})
    return saved
  }

  // ─── One invoice ───────────────────────────────────────────────────────────

  /** What is overdue on the invoice, what the policy asks for, and what was charged. */
  async preview(ctx: TenancyContext, invoiceId: string): Promise<LateFeePreview> {
    const invoice = await this.invoice(ctx, invoiceId)
    const policy = await this.policy(ctx)
    const assessments = await this.assessments(ctx, invoiceId)

    const base = {
      invoiceId,
      invoiceNumber: invoice.invoiceNumber,
      currency: invoice.currency,
      policy,
      assessments: assessments.map((row) => ({
        id: row.id,
        seq: row.seq,
        periodNo: row.period_no,
        dueDate: String(row.due_date).slice(0, 10),
        daysLate: row.days_late,
        overdue: major(row.overdue_minor),
        fee: major(row.fee_minor),
        assessedAt: row.assessed_at,
        feeInvoiceId: row.fee_invoice_id,
      })),
    }
    const nothing = (state: LateFeeState): LateFeePreview => ({
      ...base,
      state,
      lines: [],
      totalToAssess: 0,
    })

    if (invoice.type !== 'sale') return nothing('not_sale')
    if (invoice.status === 'cancelled') return nothing('cancelled')
    if (await this.isFeeInvoice(ctx, invoiceId)) return nothing('fee_invoice')
    if (!invoice.customerId) return nothing('no_customer')

    const resolved = settingsFor(policy, invoice.currency)
    if ('state' in resolved) return nothing(resolved.state)

    const schedule = await this.schedule(ctx, invoice)
    if (schedule === null) return nothing('no_due_date')

    const lines = overdueInstallments(schedule, today(), resolved.settings).map((line) => {
      const charged = assessments
        .filter((row) => row.seq === line.seq)
        .map((row) => ({ periodNo: row.period_no, feeMinor: Number(row.fee_minor) }))
      const toAssessMinor = chargeableMinor(policy!, line, charged)
      return {
        seq: line.seq,
        dueDate: line.dueDate,
        daysLate: line.daysLate,
        overdue: major(line.overdueMinor),
        fee: major(line.feeMinor),
        assessed: major(charged.reduce((sum, row) => sum + row.feeMinor, 0)),
        toAssess: major(toAssessMinor),
        capped: line.capped,
      }
    })

    return {
      ...base,
      state: 'ready',
      lines,
      totalToAssess: major(lines.reduce((sum, line) => sum + minor(line.toAssess), 0)),
    }
  }

  /**
   * Charge what the preview says can be charged, and finish any assessment
   * whose fee invoice was not issued. Returns the invoice as it now stands.
   */
  async assess(
    ctx: TenancyContext,
    invoiceId: string,
    language: LateFeeLanguage,
  ): Promise<LateFeePreview> {
    const preview = await this.preview(ctx, invoiceId)
    if (preview.state !== 'ready') {
      throw new ValidationError(`LATE_FEE_${preview.state.toUpperCase()}`)
    }
    const invoice = await this.invoice(ctx, invoiceId)
    const policy = preview.policy!

    const unfinished = preview.assessments.filter((row) => row.feeInvoiceId === null)
    const chargeable = preview.lines.filter((line) => line.toAssess > 0)
    if (unfinished.length === 0 && chargeable.length === 0) {
      throw new ValidationError('LATE_FEE_NOTHING_TO_ASSESS')
    }

    for (const row of unfinished) {
      await this.issue(ctx, invoice, language, {
        id: row.id,
        seq: row.seq,
        periodNo: row.periodNo,
        feeMinor: minor(row.fee),
      })
    }

    for (const line of chargeable) {
      const periodNo = periodOf(policy, line.daysLate)
      const feeMinor = minor(line.toAssess)
      const { data, error } = await supabase
        .from('late_fee_assessments')
        .insert({
          workspace_id: ctx.workspaceId,
          invoice_id: invoiceId,
          seq: line.seq,
          period_no: periodNo,
          due_date: line.dueDate,
          days_late: line.daysLate,
          overdue_minor: minor(line.overdue),
          fee_minor: feeMinor,
          currency: invoice.currency,
          policy,
          assessed_by: ctx.userId,
        })
        .select('id')
        .single()
      if (error) {
        // Someone else charged this period a moment ago: theirs stands.
        if (error.code === '23505') continue
        fail(error, 'Failed to record the late fee')
      }
      await this.issue(ctx, invoice, language, {
        id: String((data as { id: string }).id),
        seq: line.seq,
        periodNo,
        feeMinor,
      })
    }

    return this.preview(ctx, invoiceId)
  }

  /** Issue the fee invoice for one assessment and point the assessment at it. */
  private async issue(
    ctx: TenancyContext,
    invoice: InvoiceFacts,
    language: LateFeeLanguage,
    assessment: { id: string; seq: number; periodNo: number; feeMinor: number },
  ) {
    const fee = major(assessment.feeMinor)
    const body = createInvoiceSchema.parse({
      type: 'sale',
      date: `${today()}T00:00:00.000Z`,
      customerId: invoice.customerId,
      currency: invoice.currency,
      items: [
        {
          productName: FEE_LINE[language](invoice.invoiceNumber, assessment.seq),
          quantity: 1,
          unitPrice: fee,
          totalPrice: fee,
        },
      ],
      subtotal: fee,
      total: fee,
      paidAmount: 0,
      reference: invoice.invoiceNumber,
    }) as CreateInvoice

    const created = (await this.invoices.create(ctx, body, null, {
      // The same key for the same (invoice, installment, period), always: a
      // retried call gets back the invoice the first attempt created.
      clientRequestId: sourceIdOf(
        ctx.workspaceId,
        'late_fee',
        invoice.id,
        String(assessment.seq),
        String(assessment.periodNo),
      ),
    })) as { id?: string } | null
    if (!created?.id) throw new DatabaseError('The late fee invoice was not created', {})

    const { error } = await supabase
      .from('late_fee_assessments')
      .update({ fee_invoice_id: created.id })
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', assessment.id)
      .is('fee_invoice_id', null)
    if (error) fail(error, 'Failed to link the late fee invoice')
  }

  // ─── Reads ─────────────────────────────────────────────────────────────────

  private async invoice(ctx: TenancyContext, invoiceId: string): Promise<InvoiceFacts> {
    const { data, error } = await supabase
      .from('invoices')
      .select('id, invoice_number, type, status, customer_id, currency, due_date')
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', invoiceId)
      .maybeSingle()
    if (error) throw new DatabaseError('Failed to read the invoice', error)
    if (!data) throw new NotFoundError('Invoice')

    const owed = await supabase
      .from('invoice_outstanding')
      .select('total, allocated')
      .eq('workspace_id', ctx.workspaceId)
      .eq('invoice_id', invoiceId)
      .maybeSingle()
    if (owed.error) throw new DatabaseError('Failed to read what the invoice owes', owed.error)
    if (!owed.data) throw new NotFoundError('Invoice')

    const row = data as Record<string, unknown>
    return {
      id: String(row.id),
      invoiceNumber: String(row.invoice_number ?? ''),
      type: String(row.type ?? ''),
      status: String(row.status ?? ''),
      customerId: (row.customer_id as string | null) ?? null,
      currency: String(row.currency ?? ''),
      dueDate: row.due_date ? String(row.due_date).slice(0, 10) : null,
      totalMinor: minor(Number((owed.data as { total: unknown }).total) || 0),
      allocatedMinor: minor(Number((owed.data as { allocated: unknown }).allocated) || 0),
    }
  }

  /**
   * What is due and when: the installment plan when the invoice has one,
   * otherwise the invoice as one line on its own due date. `null` = no plan and
   * no due date, so nothing can be late.
   */
  private async schedule(
    ctx: TenancyContext,
    invoice: InvoiceFacts,
  ): Promise<InstallmentSchedule[] | null> {
    let planned: InstallmentSchedule[] = []
    try {
      const plan = await installmentService.get(ctx, invoice.id)
      planned = plan.lines.map((line) => ({
        id: `${invoice.id}:${line.seq}`,
        invoiceId: invoice.id,
        seq: line.seq,
        dueDate: line.dueDate,
        amountMinor: minor(line.amount),
        paidMinor: minor(line.paid),
      }))
    } catch (error) {
      // Before the installments migration no invoice has a plan — which is true.
      if (!(error instanceof InstallmentsNotConfiguredError)) throw error
    }
    if (planned.length > 0) return planned
    if (!invoice.dueDate) return null
    return [
      {
        id: invoice.id,
        invoiceId: invoice.id,
        seq: 0,
        dueDate: invoice.dueDate,
        amountMinor: invoice.totalMinor,
        paidMinor: Math.min(invoice.totalMinor, Math.max(0, invoice.allocatedMinor)),
      },
    ]
  }

  private async assessments(ctx: TenancyContext, invoiceId: string): Promise<AssessmentRow[]> {
    const { data, error } = await supabase
      .from('late_fee_assessments')
      .select(ASSESSMENT_COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .eq('invoice_id', invoiceId)
      .order('assessed_at', { ascending: true })
    if (error) fail(error, 'Failed to read the late fees charged')
    return (data ?? []) as AssessmentRow[]
  }

  private async isFeeInvoice(ctx: TenancyContext, invoiceId: string): Promise<boolean> {
    const { count, error } = await supabase
      .from('late_fee_assessments')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', ctx.workspaceId)
      .eq('fee_invoice_id', invoiceId)
    if (error) fail(error, 'Failed to check the invoice')
    return (count ?? 0) > 0
  }
}

export const lateFeeService = new LateFeeService()
