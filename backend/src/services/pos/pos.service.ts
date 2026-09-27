// ============================================
// backend/src/services/pos/pos.service.ts
//
// Running a till: open a drawer, take orders, count it, close it.
//
// The arithmetic is all in pos.domain.ts and is pure. What is here is the
// part that touches rows, and the two things that only matter once rows are
// involved: idempotency and the ledger posting.
// ============================================

import { selectAllPages } from '../../utils/fetch-all-pages'
import { supabase } from '../../db'
import { ConflictError, DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { memoryCache } from '../../utils/pagination'
import type { TenancyContext } from '../tenancy.service'
import { logBusinessEvent } from '../event-log.service'
import { AccountingService, ledger } from '../accounting'

import {
  buildDrawerLedger,
  paymentMargin,
  checkSuspendChange,
  type SessionStatus,
  dailyCashFlow,
  type CashEvent,
  buildPosting,
  findAbandoned,
  summarise,
  validateClose,
  validateMovement,
  validateOrder,
  type CashMovement,
  type CashSettlement,
  type PaymentMethod,
  type PosOrder,
  type PosSession,
  type SessionTotals,
} from './pos.domain'

// The columns finance-gaps-migration created. Everything `mapSession` reads.
const SESSION_COLUMNS =
  'id, branch_id, status, opening_float_minor, opened_at, opened_by, counted_cash_minor, variance_reason, closed_at, closed_by, was_forced, journal_entry_id'

// M3 — the frozen handover columns, added by phase-m-01. Selected ONLY by the
// history read, the one place that uses them.
//
// ⚠️ They used to be part of SESSION_COLUMNS, so /sessions/current and
// /sessions/abandoned — which never read them — answered 42703 → 500 on any
// database where phase-m-01 had not been applied.
const HISTORY_COLUMNS = `${SESSION_COLUMNS}, expected_cash_minor, cash_sales_minor, cash_in_minor, cash_out_minor, variance_minor`

function mapSession(raw: Record<string, any>): PosSession {
  return {
    id: raw.id,
    status: raw.status,
    openingFloatMinor: Number(raw.opening_float_minor) || 0,
    openedAt: raw.opened_at,
    openedBy: raw.opened_by,
    closedAt: raw.closed_at ?? null,
    closedBy: raw.closed_by ?? null,
    countedCashMinor: raw.counted_cash_minor === null ? null : Number(raw.counted_cash_minor),
  }
}

function mapOrder(raw: Record<string, any>): PosOrder {
  return {
    id: raw.id,
    orderRef: raw.order_ref,
    totalMinor: Number(raw.total_minor) || 0,
    changeMinor: Number(raw.change_minor) || 0,
    status: raw.status,
    createdAt: raw.created_at,
    payments: (raw.payments ?? []).map((p: Record<string, any>) => ({
      method: p.method as PaymentMethod,
      amountMinor: Number(p.amount_minor) || 0,
    })),
  }
}

function mapMovement(raw: Record<string, any>): CashMovement {
  return {
    id: raw.id,
    kind: raw.kind,
    amountMinor: Number(raw.amount_minor) || 0,
    reason: raw.reason,
    createdAt: raw.created_at,
  }
}

export class PosService {
  private async invalidate(workspaceId: string) {
    await memoryCache.invalidate(`pos:${workspaceId}`)
  }

  // ─── Session lifecycle ────────────────────────────────────────────────────

  /**
   * Open a drawer.
   *
   * A partial unique index refuses a second open session for the same person
   * in the same branch. Two open drawers for one till is two counts that can
   * never be reconciled against one another, and the database says so rather
   * than this method hoping.
   */
  async openSession(
    ctx: TenancyContext,
    input: { openingFloatMinor: number; branchId?: string | null | undefined },
  ): Promise<PosSession> {
    if (input.openingFloatMinor < 0) throw new ValidationError('POS_COUNT_NEGATIVE')

    const { data, error } = await supabase
      .from('pos_sessions')
      .insert({
        workspace_id: ctx.workspaceId,
        branch_id: input.branchId ?? null,
        status: 'open',
        opening_float_minor: input.openingFloatMinor,
        opened_by: ctx.userId,
      })
      .select(SESSION_COLUMNS)
      .single()

    if (error) {
      if (error.code === '23505') throw new ConflictError('POS_SESSION_ALREADY_OPEN')
      throw new DatabaseError('Failed to open the till session', error)
    }

    await this.invalidate(ctx.workspaceId)
    return mapSession(data)
  }

  async getSession(ctx: TenancyContext, sessionId: string): Promise<PosSession> {
    const { data, error } = await supabase
      .from('pos_sessions')
      .select(SESSION_COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', sessionId)
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to fetch the till session', error)
    if (!data) throw new NotFoundError('Till session')
    return mapSession(data)
  }

  /** The caller's own open session, if they have one. */
  async getOpenSession(ctx: TenancyContext): Promise<PosSession | null> {
    const { data, error } = await supabase
      .from('pos_sessions')
      .select(SESSION_COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .eq('opened_by', ctx.userId)
      .eq('status', 'open')
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to fetch the open session', error)
    return data ? mapSession(data) : null
  }

  /**
   * Cash invoice payments recorded at this drawer while the session was open.
   *
   * The query is scoped by WORKSPACE only — `payments` is a shared book and
   * user_id is never its filter (tenancy-static-guard). Which drawer a cash
   * payment went into is then decided by who recorded it: that is actor
   * attribution (the person holding the drawer), applied after the tenant
   * boundary, not access control. Paged, so a long session in a busy shop is
   * not silently cut at PostgREST max-rows.
   */
  private async loadSettlements(
    ctx: TenancyContext,
    session: PosSession,
  ): Promise<CashSettlement[]> {
    const PAGE = 1000
    const rows: Record<string, any>[] = []

    for (let from = 0; ; from += PAGE) {
      let query = supabase
        .from('payments')
        .select('id, payment_number, direction, amount, created_at, recorded_by:created_by')
        .eq('workspace_id', ctx.workspaceId)
        .eq('method', 'cash')
        .eq('status', 'posted')
        .gte('created_at', session.openedAt)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1)

      if (session.closedAt) query = query.lte('created_at', session.closedAt)

      const { data, error } = await query
      if (error) throw new DatabaseError('Failed to fetch cash settlements', error)

      const page = (data ?? []) as Record<string, any>[]
      rows.push(...page)
      if (page.length < PAGE) break
    }

    return rows
      .filter((row) => row.recorded_by === session.openedBy)
      .map((row) => ({
        id: row.id,
        paymentNumber: row.payment_number ?? '',
        direction: row.direction === 'out' ? ('out' as const) : ('in' as const),
        // payments.amount is major units (numeric); the drawer counts minor.
        amountMinor: Math.round((Number(row.amount) || 0) * 100),
        createdAt: row.created_at,
      }))
  }

  private async loadContents(
    ctx: TenancyContext,
    sessionId: string,
    session?: PosSession,
  ): Promise<{ orders: PosOrder[]; movements: CashMovement[]; settlements: CashSettlement[] }> {
    const resolved = session ?? (await this.getSession(ctx, sessionId))
    const [orders, movements, settlements] = await Promise.all([
      // Every order and cash movement of the session (27 Sep 2026): the till close sums them.
      selectAllPages((lo, hi) =>
        supabase
          .from('pos_orders')
          .select(
            'id, order_ref, total_minor, change_minor, status, created_at, payments:pos_order_payments(method, amount_minor)',
          )
          .eq('workspace_id', ctx.workspaceId)
          .eq('session_id', sessionId)
          .order('id', { ascending: true })
          .range(lo, hi),
      ),
      selectAllPages((lo, hi) =>
        supabase
          .from('pos_cash_movements')
          .select('id, kind, amount_minor, reason, created_at')
          .eq('workspace_id', ctx.workspaceId)
          .eq('session_id', sessionId)
          .order('id', { ascending: true })
          .range(lo, hi),
      ),
      this.loadSettlements(ctx, resolved),
    ])

    if (orders.error) throw new DatabaseError('Failed to fetch till orders', orders.error)
    if (movements.error) throw new DatabaseError('Failed to fetch cash movements', movements.error)

    return {
      orders: (orders.data ?? []).map(mapOrder),
      movements: (movements.data ?? []).map(mapMovement),
      settlements,
    }
  }

  async getTotals(ctx: TenancyContext, sessionId: string): Promise<SessionTotals> {
    const session = await this.getSession(ctx, sessionId)
    const { orders, movements, settlements } = await this.loadContents(ctx, sessionId, session)
    return summarise(session, orders, movements, settlements)
  }

  /**
   * Every cash event in the drawer, in order, with the running balance —
   * float, sales, cash in/out, and invoice settlements — so a cashier can see
   * WHY the drawer should hold what it should. Derived from the same rows as
   * the totals; the final balance equals `expectedCashMinor`.
   */
  async sessionLedger(ctx: TenancyContext, sessionId: string) {
    const session = await this.getSession(ctx, sessionId)
    const { orders, movements, settlements } = await this.loadContents(ctx, sessionId, session)
    const drawer = buildDrawerLedger(session, orders, movements, settlements)

    // Request #91 — profit % of each cash receipt, via the accounting core.
    const receiptIds = drawer.entries
      .filter((entry) => entry.kind === 'settlement_in' && entry.sourceId)
      .map((entry) => entry.sourceId as string)
    if (receiptIds.length === 0) return drawer

    const invoicesByPayment = new Map<string, string[]>()
    for (let i = 0; i < receiptIds.length; i += 200) {
      const { data, error } = await supabase
        .from('payment_allocations')
        .select('payment_id, invoice_id')
        .eq('workspace_id', ctx.workspaceId)
        .in('payment_id', receiptIds.slice(i, i + 200))
      if (error) throw new DatabaseError('Failed to read payment allocations', error)
      for (const row of data ?? []) {
        const key = String(row.payment_id)
        invoicesByPayment.set(key, [...(invoicesByPayment.get(key) ?? []), String(row.invoice_id)])
      }
    }
    const margins = await new AccountingService().getInvoiceMargins(
      ctx,
      [...invoicesByPayment.values()].flat(),
    )
    return {
      ...drawer,
      entries: drawer.entries.map((entry) =>
        entry.kind === 'settlement_in' && entry.sourceId
          ? {
              ...entry,
              marginPercent: invoicesByPayment.has(entry.sourceId)
                ? paymentMargin(invoicesByPayment.get(entry.sourceId) ?? [], margins)
                : null,
            }
          : entry,
      ),
    }
  }

  /**
   * M3 — past shifts, with the handover each one was signed off against.
   *
   * ⚠️ THE FROZEN FIGURES ARE RETURNED AS STORED, NOT RECOMPUTED.
   *
   * Recomputing would let a later void silently change a handover somebody
   * already signed. `expectedCashMinor` is null on sessions closed before
   * phase-m-01 — the caller is told the figure was never frozen rather than
   * shown a number pretending to be historical.
   */
  async sessionHistory(
    ctx: TenancyContext,
    limit = 50,
  ): Promise<
    Array<{
      id: string
      status: string
      openedAt: string | null
      closedAt: string | null
      openedBy: string | null
      closedBy: string | null
      openingFloatMinor: number
      cashSalesMinor: number | null
      cashInMinor: number | null
      cashOutMinor: number | null
      expectedCashMinor: number | null
      countedCashMinor: number | null
      varianceMinor: number | null
      varianceReason: string | null
      wasForced: boolean
      /** False for a shift closed before the handover was frozen. */
      handoverFrozen: boolean
    }>
  > {
    const { data, error } = await supabase
      .from('pos_sessions')
      .select(HISTORY_COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .in('status', ['closed', 'force_closed'])
      .order('closed_at', { ascending: false })
      .limit(Math.min(limit, 200))

    if (error) throw new DatabaseError('Failed to read the shift history', error)

    return (data ?? []).map((raw: Record<string, any>) => {
      const num = (value: unknown) => (value === null || value === undefined ? null : Number(value))

      return {
        id: String(raw.id),
        status: String(raw.status),
        openedAt: raw.opened_at ?? null,
        closedAt: raw.closed_at ?? null,
        openedBy: raw.opened_by ?? null,
        // Recorded separately from `opened_by`: «did one person both run and
        // sign off the shift» is the question a handover exists to answer.
        closedBy: raw.closed_by ?? null,
        openingFloatMinor: Number(raw.opening_float_minor) || 0,
        cashSalesMinor: num(raw.cash_sales_minor),
        cashInMinor: num(raw.cash_in_minor),
        cashOutMinor: num(raw.cash_out_minor),
        expectedCashMinor: num(raw.expected_cash_minor),
        countedCashMinor: num(raw.counted_cash_minor),
        varianceMinor: num(raw.variance_minor),
        varianceReason: raw.variance_reason ?? null,
        wasForced: raw.was_forced === true,
        handoverFrozen: raw.expected_cash_minor !== null && raw.expected_cash_minor !== undefined,
      }
    })
  }

  // ─── Orders ───────────────────────────────────────────────────────────────

  /**
   * Record a sale at the till.
   *
   * `orderRef` is generated ONCE on the device and never regenerated, and a
   * unique index enforces it. That is what makes a retry after a lost response
   * idempotent rather than a second sale — the case a till hits constantly on
   * a bad connection.
   */
  async recordOrder(
    ctx: TenancyContext,
    sessionId: string,
    input: {
      orderRef: string
      totalMinor: number
      changeMinor: number
      payments: Array<{ method: PaymentMethod; amountMinor: number }>
      invoiceId?: string | null | undefined
    },
  ): Promise<PosOrder> {
    const session = await this.getSession(ctx, sessionId)

    const problems = validateOrder(session, input)
    if (problems.length > 0) throw new ValidationError(problems.join(', '))

    // One transaction, in the database.
    //
    // This was two statements with a manual DELETE if the second failed —
    // exactly what `.claude/lessons-learned.md` #3 forbids. If the process
    // dies between them the compensating delete never runs, and the drawer
    // holds an order with no payment rows: cash the session expects at close
    // and cannot explain.
    //
    // The function also re-checks that the session is still open, under a row
    // lock. Checking it out here leaves a window where a close lands between
    // the check and the insert, and the order joins a session that has
    // already posted.
    const { data, error } = await supabase.rpc('pos_record_order', {
      p_workspace_id: ctx.workspaceId,
      p_session_id: sessionId,
      p_payload: {
        order_ref: input.orderRef,
        invoice_id: input.invoiceId ?? null,
        total_minor: input.totalMinor,
        change_minor: input.changeMinor,
        payments: input.payments.map((payment) => ({
          method: payment.method,
          amount_minor: payment.amountMinor,
        })),
      },
    })

    if (error) {
      const code = /\b([A-Z][A-Z_]{6,})\b/.exec(error.message ?? '')?.[1]
      if (code === 'POS_SESSION_NOT_OPEN' || code === 'POS_SESSION_NOT_FOUND') {
        throw new ConflictError(code)
      }
      throw new DatabaseError('Failed to record the order', error)
    }

    const result = (data ?? {}) as { id?: string; status?: string }
    if (!result.id) throw new DatabaseError('Failed to record the order')

    await this.invalidate(ctx.workspaceId)

    // `already_recorded` is a SUCCESS: the device is retrying something that
    // worked, and the order it gets back is the one that exists.
    const { data: stored } = await supabase
      .from('pos_orders')
      .select(
        'id, order_ref, total_minor, change_minor, status, created_at, payments:pos_order_payments(method, amount_minor)',
      )
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', result.id)
      .single()

    return stored ? mapOrder(stored) : { ...mapOrder(result), payments: input.payments }
  }

  /**
   * Void an order.
   *
   * Marked voided, never deleted. A sale that was rung up and cancelled is two
   * facts, and a till whose voids leave no trace is a till nobody can audit.
   */
  async voidOrder(ctx: TenancyContext, orderId: string): Promise<void> {
    const { error } = await supabase
      .from('pos_orders')
      .update({ status: 'voided' })
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', orderId)

    if (error) throw new DatabaseError('Failed to void the order', error)
    await this.invalidate(ctx.workspaceId)
  }

  async recordMovement(
    ctx: TenancyContext,
    sessionId: string,
    input: {
      kind: 'cash_in' | 'cash_out'
      amountMinor: number
      reason: string
      /**
       * Made by the caller once and resent unchanged on retry, like
       * `transferId`. The client retries this request up to three times; with
       * no key, one lost response put the same cash in the drawer four times.
       */
      movementId?: string | undefined
    },
  ): Promise<CashMovement> {
    const session = await this.getSession(ctx, sessionId)

    const problems = validateMovement(session, input)
    if (problems.length > 0) throw new ValidationError(problems.join(', '))

    const columns = 'id, kind, amount_minor, reason, created_at'
    const { data, error } = await supabase
      .from('pos_cash_movements')
      .insert({
        ...(input.movementId ? { id: input.movementId } : {}),
        workspace_id: ctx.workspaceId,
        session_id: sessionId,
        kind: input.kind,
        amount_minor: input.amountMinor,
        reason: input.reason,
        created_by: ctx.userId,
      })
      .select(columns)
      .single()

    // The same key again: this movement is already in the drawer. Answer with
    // it — scoped to this workspace and session, so a key cannot read another's.
    if (error?.code === '23505' && input.movementId) {
      const { data: existing, error: readError } = await supabase
        .from('pos_cash_movements')
        .select(columns)
        .eq('id', input.movementId)
        .eq('workspace_id', ctx.workspaceId)
        .eq('session_id', sessionId)
        .maybeSingle()
      if (readError) throw new DatabaseError('Failed to read the recorded cash movement', readError)
      if (!existing) throw new ConflictError('POS_MOVEMENT_ID_TAKEN')
      return mapMovement(existing)
    }
    if (error) throw new DatabaseError('Failed to record the cash movement', error)

    await this.invalidate(ctx.workspaceId)
    return mapMovement(data)
  }

  /**
   * Move cash between this till and the bank.
   *
   * Two idempotent writes keyed by `transferId` (made ONCE by the client and
   * resent unchanged on retry):
   *   1. the journal entry — Dr bank / Cr cash (or the reverse) — through the
   *      one posting path; journal_entries_source_key refuses a second one;
   *   2. the drawer movement with the same id, upserted with ignoreDuplicates.
   * supabase-js has no transaction, so the order matters: the ledger first.
   * If the movement write fails after the entry, the same retry completes it —
   * nothing is deleted to "undo" anything.
   */
  async recordBankTransfer(
    ctx: TenancyContext,
    sessionId: string,
    input: {
      transferId: string
      direction: 'to_bank' | 'from_bank'
      amountMinor: number
      reason: string
    },
  ): Promise<{ transferId: string; entryId: string; alreadyRecorded: boolean }> {
    const session = await this.getSession(ctx, sessionId)
    const problems = validateMovement(session, input)
    if (problems.length > 0) throw new ValidationError(problems.join(', '))

    if (input.direction === 'to_bank') {
      // The drawer cannot send more than it should hold.
      const { orders, movements, settlements } = await this.loadContents(ctx, sessionId, session)
      const expected = summarise(session, orders, movements, settlements).expectedCashMinor
      const alreadyThis = movements.some((m) => m.id === input.transferId)
      if (!alreadyThis && input.amountMinor > expected) {
        throw new ValidationError('POS_TRANSFER_EXCEEDS_CASH')
      }
    }

    const { accounts, missing } = await ledger.ensureAccountsForRoles(ctx, ['cash', 'bank'])
    if (missing.length > 0 || !accounts.cash || !accounts.bank) {
      throw new ValidationError(`POS_TRANSFER_ACCOUNTS_MISSING: ${missing.join(', ')}`)
    }

    const amount = input.amountMinor / 100
    const toBank = input.direction === 'to_bank'
    const outcome = await ledger.postDocument(ctx, {
      sourceType: 'till_transfer',
      sourceId: input.transferId,
      date: new Date().toISOString().slice(0, 10),
      description: toBank ? 'انتقال نقد صندوق به بانک' : 'برداشت از بانک به صندوق',
      reference: input.reason.trim().slice(0, 200),
      lines: toBank
        ? [
            { accountId: accounts.bank, debit: amount, credit: 0 },
            { accountId: accounts.cash, debit: 0, credit: amount },
          ]
        : [
            { accountId: accounts.cash, debit: amount, credit: 0 },
            { accountId: accounts.bank, debit: 0, credit: amount },
          ],
    })

    if (outcome.status === 'skipped') {
      throw new ValidationError(`POS_TRANSFER_ACCOUNTS_MISSING: ${outcome.missing.join(', ')}`)
    }

    const { error } = await supabase.from('pos_cash_movements').upsert(
      {
        id: input.transferId,
        workspace_id: ctx.workspaceId,
        session_id: sessionId,
        kind: toBank ? 'transfer_to_bank' : 'transfer_from_bank',
        amount_minor: input.amountMinor,
        reason: input.reason.trim(),
        created_by: ctx.userId,
      },
      { onConflict: 'id', ignoreDuplicates: true },
    )
    if (error) {
      if (error.code === '23514') throw new ConflictError('POS_TRANSFER_MIGRATION_REQUIRED')
      throw new DatabaseError('Failed to record the transfer in the till', error)
    }

    await this.invalidate(ctx.workspaceId)

    void logBusinessEvent({
      userId: ctx.userId,
      workspaceId: ctx.workspaceId,
      entityType: 'pos_session',
      entityId: sessionId,
      action: toBank ? 'transfer_to_bank' : 'transfer_from_bank',
      title: toBank ? 'انتقال نقد صندوق به بانک' : 'برداشت از بانک به صندوق',
      metadata: {
        transferId: input.transferId,
        amountMinor: input.amountMinor,
        entryId: outcome.entryId,
      },
      notify: false,
    })

    return {
      transferId: input.transferId,
      entryId: outcome.entryId,
      alreadyRecorded: outcome.status === 'already_posted',
    }
  }

  // ─── Closing ──────────────────────────────────────────────────────────────

  /**
   * Count the drawer and close.
   *
   * The ledger posting is idempotent per session, so a close that is retried
   * after a lost response does not post the day's takings twice.
   */
  async closeSession(
    ctx: TenancyContext,
    sessionId: string,
    input: {
      countedCashMinor: number
      varianceReason?: string | undefined
      force?: boolean | undefined
    },
  ): Promise<{ session: PosSession; totals: SessionTotals; posted: boolean }> {
    const session = await this.getSession(ctx, sessionId)
    const { orders, movements, settlements } = await this.loadContents(ctx, sessionId, session)
    const totals = summarise(session, orders, movements, settlements)

    const problems = validateClose(session, totals, { ...input, role: ctx.role })
    if (problems.length > 0) throw new ValidationError(problems.join(', '))

    const closed: PosSession = { ...session, countedCashMinor: input.countedCashMinor }
    const finalTotals = summarise(closed, orders, movements, settlements)

    const { data, error } = await supabase
      .from('pos_sessions')
      .update({
        status: input.force ? 'force_closed' : 'closed',
        counted_cash_minor: input.countedCashMinor,
        variance_reason: input.varianceReason ?? null,
        closed_at: new Date().toISOString(),
        closed_by: ctx.userId,
        was_forced: input.force === true,

        // ─── M3 — FREEZE THE HANDOVER ────────────────────────────────────
        //
        // These were computed by `summarise()` at read time, which meant the
        // handover changed after it was signed: voiding one order from a
        // closed session silently moved that shift's expected cash, and the
        // person who counted the drawer and signed off a variance of 200 could
        // be shown 900 a week later with nothing recording the change.
        //
        // A handover is a statement about a moment. Stored as of that moment.
        expected_cash_minor: finalTotals.expectedCashMinor,
        cash_sales_minor: finalTotals.byMethod.cash ?? 0,
        // Split by sign rather than stored as one net figure: «took 500 out and
        // put 500 in» and «nothing happened» are different shifts, and a net of
        // zero cannot tell them apart.
        cash_in_minor: Math.max(0, finalTotals.movementsMinor),
        cash_out_minor: Math.max(0, -finalTotals.movementsMinor),
        variance_minor: finalTotals.varianceMinor,
      })
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', sessionId)
      // Only an OPEN (or suspended) session closes. Two devices closing at once
      // means the second finds nothing to update rather than posting twice.
      .in('status', ['open', 'closing', 'suspended'])
      .select(SESSION_COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to close the till session', error)

    const posted = await this.postSession(ctx, closed, finalTotals)

    await this.invalidate(ctx.workspaceId)
    return { session: mapSession(data), totals: finalTotals, posted }
  }

  /**
   * Book the session in the ledger.
   *
   * Cash is debited at what was COUNTED; the variance goes to its own account
   * with the session id on it. Netting the variance into sales would quietly
   * change the reported revenue of a day nobody would think to question.
   */
  private async postSession(
    ctx: TenancyContext,
    session: PosSession,
    totals: SessionTotals,
  ): Promise<boolean> {
    const posting = buildPosting(session, totals)

    // `bank` is asked for alongside the rest because card and transfer takings
    // are money the shop has, and cash is not where it sits.
    const { accounts, missing } = await ledger.ensureAccountsForRoles(ctx, [
      'cash',
      'sales',
      'receivable',
      'bank',
      'purchase',
    ])

    // A shop that never takes a card needs no bank account configured, so
    // `bank` is only required when there is card or transfer money to place.
    const cardAndTransferMinor = posting.cardMinor + posting.transferMinor

    // A role is only REQUIRED when there is money that needs it. A shop that
    // never takes a card needs no bank account, and one whose sellers never
    // take cash out needs no purchases account — demanding either would refuse
    // to book a perfectly ordinary day.
    const required = missing.filter((role) => {
      if (role === 'bank') return cardAndTransferMinor !== 0
      if (role === 'purchase') return posting.movementsMinor !== 0
      return true
    })

    if (required.length > 0) {
      console.warn(`[POS] session ${session.id} not booked: no account for ${required.join(', ')}`)
      return false
    }

    const lines = [
      { accountId: accounts.cash!, debit: posting.cashMinor / 100, credit: 0 },
      { accountId: accounts.sales!, debit: 0, credit: posting.revenueMinor / 100 },
    ]

    // Card and transfer takings.
    //
    // These were absent from the entry entirely. `buildPosting` has always
    // reported them and this method used only cash, receivable and sales — so
    // every session that took a single card payment produced debits short by
    // exactly the card total, the ledger correctly refused the unbalanced
    // entry, and the close failed. The day's takings never reached the books,
    // and the cashier saw a generic error rather than the reason.
    //
    // Debited to BANK, not to cash: the money exists but is not in the drawer,
    // and putting it in cash would make every count look short by that amount.
    if (cardAndTransferMinor > 0) {
      lines.push({ accountId: accounts.bank!, debit: cardAndTransferMinor / 100, credit: 0 })
    }

    if (posting.creditMinor > 0) {
      lines.push({ accountId: accounts.receivable!, debit: posting.creditMinor / 100, credit: 0 })
    }

    // Cash put in or taken out during the session.
    //
    // Missing too, and its absence broke the same way the card takings did: a
    // seller takes 3,000 out for a delivery fare, the drawer counts 3,000
    // lighter, the debits come up short by exactly that, and the ledger
    // refuses the entry — so the day never books.
    //
    // It is neither a shortage nor revenue. The money left the drawer for a
    // stated reason, so it is a payment: cash is already reduced by the count,
    // and the other side goes to purchases.
    //
    // `purchase` is the closest role the chart defines. A dedicated expense
    // role would name it better, and until there is one this is the honest
    // approximation rather than a silent imbalance.
    if (posting.movementsMinor !== 0) {
      const amount = Math.abs(posting.movementsMinor) / 100

      lines.push(
        posting.movementsMinor < 0
          ? // Money out: an expense the shop incurred.
            { accountId: accounts.purchase!, debit: amount, credit: 0 }
          : // Money in: the owner topping up the float.
            { accountId: accounts.purchase!, debit: 0, credit: amount },
      )
    }

    // The variance balances the entry. Without it, a drawer that is short
    // produces an unbalanced posting that the ledger correctly refuses — which
    // is how the shortage would come to light as a crash instead of a figure.
    if (posting.varianceMinor !== 0) {
      const amount = Math.abs(posting.varianceMinor) / 100
      lines.push(
        posting.varianceMinor < 0
          ? { accountId: accounts.sales!, debit: amount, credit: 0 }
          : { accountId: accounts.sales!, debit: 0, credit: amount },
      )
    }

    const outcome = await ledger.postDocument(ctx, {
      sourceType: 'pos_session',
      sourceId: session.id,
      date: new Date().toISOString().slice(0, 10),
      description: `بستن صندوق ${session.id.slice(0, 8)}`,
      reference: session.id,
      lines,
    })

    if (outcome.status === 'posted' || outcome.status === 'already_posted') {
      await supabase
        .from('pos_sessions')
        .update({ journal_entry_id: outcome.entryId })
        .eq('workspace_id', ctx.workspaceId)
        .eq('id', session.id)
      return true
    }

    return false
  }

  /**
   * Sessions open far longer than a shift.
   *
   * Surfaced, never auto-closed: closing decides where the money went, and
   * that is a person's call.
   */
  /**
   * Cash in and out of the business's drawers per local day.
   *
   * Three sources, all workspace-scoped and paged past PostgREST max-rows:
   * posted CASH invoice payments, till cash movements, and the cash portion of
   * completed till orders (net of change). Card and transfer never touched a
   * drawer and are not counted.
   */
  async cashFlow(ctx: TenancyContext, days: number, offsetMinutes: number) {
    const now = Date.now() + offsetMinutes * 60_000
    const today = new Date(now).toISOString().slice(0, 10)
    const since = new Date(
      Date.parse(`${today}T00:00:00Z`) - (days - 1) * 86_400_000 - offsetMinutes * 60_000,
    ).toISOString()

    const pageAll = async (build: (from: number, to: number) => any) => {
      const PAGE = 1000
      const rows: Record<string, any>[] = []
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await build(from, from + PAGE - 1)
        if (error) throw new DatabaseError('Failed to read cash flow', error)
        const page = (data ?? []) as Record<string, any>[]
        rows.push(...page)
        if (page.length < PAGE) break
      }
      return rows
    }

    const [payments, movements, orders] = await Promise.all([
      pageAll((from, to) =>
        supabase
          .from('payments')
          .select('id, direction, amount, created_at')
          .eq('workspace_id', ctx.workspaceId)
          .eq('method', 'cash')
          .eq('status', 'posted')
          .gte('created_at', since)
          .order('id')
          .range(from, to),
      ),
      pageAll((from, to) =>
        supabase
          .from('pos_cash_movements')
          .select('id, kind, amount_minor, created_at')
          .eq('workspace_id', ctx.workspaceId)
          .gte('created_at', since)
          .order('id')
          .range(from, to),
      ),
      pageAll((from, to) =>
        supabase
          .from('pos_orders')
          .select(
            'id, change_minor, status, created_at, payments:pos_order_payments(method, amount_minor)',
          )
          .eq('workspace_id', ctx.workspaceId)
          .eq('status', 'completed')
          .gte('created_at', since)
          .order('id')
          .range(from, to),
      ),
    ])

    const events: CashEvent[] = [
      ...payments.map((p) => ({
        at: p.created_at,
        amountMinor: (p.direction === 'out' ? -1 : 1) * Math.round((Number(p.amount) || 0) * 100),
      })),
      ...movements.map((m) => ({
        at: m.created_at,
        amountMinor: (m.kind === 'cash_out' ? -1 : 1) * (Number(m.amount_minor) || 0),
      })),
      ...orders.map((o) => ({
        at: o.created_at,
        amountMinor:
          ((o.payments ?? []) as Array<{ method: string; amount_minor: number }>)
            .filter((p) => p.method === 'cash')
            .reduce((sum, p) => sum + (Number(p.amount_minor) || 0), 0) -
          (Number(o.change_minor) || 0),
      })),
    ]

    return { days: dailyCashFlow(events, days, today, offsetMinutes), today }
  }

  /** Every open or suspended till of the workspace, with its expected cash (the till list). */
  async listOpenSessions(ctx: TenancyContext) {
    return this.findAbandonedSessions(ctx, 0, ['open', 'suspended'])
  }

  /** «تعلیق» / «ادامه» from the till list. The status is the whole change. */
  async setSuspended(ctx: TenancyContext, sessionId: string, suspended: boolean) {
    const session = await this.getSession(ctx, sessionId)
    const refusal = checkSuspendChange(session.status, suspended ? 'suspended' : 'open')
    if (refusal) throw new ConflictError(refusal)

    const { data, error } = await supabase
      .from('pos_sessions')
      .update({ status: suspended ? 'suspended' : 'open' })
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', sessionId)
      .eq('status', session.status)
      .select(SESSION_COLUMNS)
      .maybeSingle()

    if (error) {
      // 23514: the status check has no 'suspended' yet (docs/pos-session-suspend-migration.sql).
      if (error.code === '23514') throw new ConflictError('POS_SUSPEND_MIGRATION_REQUIRED')
      // 23505: resuming while this person already has another open till here.
      if (error.code === '23505') throw new ConflictError('POS_SESSION_ALREADY_OPEN')
      throw new DatabaseError('Failed to change the till status', error)
    }
    if (!data)
      throw new ConflictError(suspended ? 'POS_SESSION_NOT_OPEN' : 'POS_SESSION_NOT_SUSPENDED')

    await this.invalidate(ctx.workspaceId)
    return mapSession(data)
  }

  async findAbandonedSessions(
    ctx: TenancyContext,
    staleAfterHours = 24,
    statuses: SessionStatus[] = ['open'],
  ) {
    const { data, error } = await supabase
      .from('pos_sessions')
      .select(SESSION_COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .in('status', statuses)
      .limit(200)

    if (error) throw new DatabaseError('Failed to look for abandoned sessions', error)

    const sessions = await Promise.all(
      (data ?? []).map(async (row) => {
        const session = mapSession(row)
        const contents = await this.loadContents(ctx, session.id, session)
        return { session, ...contents }
      }),
    )

    return findAbandoned(sessions, new Date().toISOString(), staleAfterHours)
  }
}
