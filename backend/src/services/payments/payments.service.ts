// ============================================
// backend/src/services/payments/payments.service.ts
//
// Recording money in and money out, applying it to the invoices it settles,
// and booking the result in the ledger.
//
// The core does three things the system could not do before: it records a
// payment as its own document, it says WHICH invoices that payment settled,
// and it keeps whatever was overpaid as an advance instead of losing it.
// ============================================

import { ConflictError, NotFoundError } from '../../errors/database.error'
import {
  asReplay,
  IdempotencyUnavailableError,
  isMissingIdempotencySupport,
} from '../../utils/client-request'
import { ValidationError } from '../../errors/validation.error'
import { memoryCache } from '../../utils/pagination'
import { invalidateMoneyCaches } from '../../utils/money-cache'
import type { TenancyContext } from '../tenancy.service'
import { ledger } from '../accounting'
import { scopes, sod } from '../authorization'
import { logBusinessEvent } from '../event-log.service'

import {
  ageInvoices,
  autoAllocate,
  emptyAging,
  openInvoices,
  outstandingOf,
  partyBalance,
  round2,
  runningLedger,
  summarizeParty,
  unallocatedOf,
  validateAllocations,
  type AgingBuckets,
  type AllocationRequest,
  type LedgerMovement,
  type OpenInvoice,
  type PartyType,
  type PartySummary,
  type PaymentDirection,
} from './payments.domain'
import { PaymentsRepository, domainErrorCode, type PaymentRow } from './payments.repository'

export interface RecordPaymentInput {
  direction: PaymentDirection
  partyType: PartyType
  /** null only for a walk-in invoice, and then allocations must name it. */
  partyId: string | null
  amount: number
  entryDate?: string | undefined
  currency?: string | undefined
  method?: string | undefined
  reference?: string | undefined
  notes?: string | undefined
  /** Omit to settle the oldest open invoices first. */
  allocations?: AllocationRequest[] | undefined
}

const today = () => new Date().toISOString().slice(0, 10)

export class PaymentsService {
  private readonly repo: PaymentsRepository

  constructor(repo: PaymentsRepository = new PaymentsRepository()) {
    this.repo = repo
  }

  private async invalidate(workspaceId: string) {
    // A payment changes the invoice's remaining balance, the customer's debt,
    // the ledger and the dashboard. It used to clear only the service caches,
    // so GET /api/invoices/:id (route cache, `invoice:` prefix, 120 s) kept
    // showing the pre-payment balance — see utils/money-cache.ts.
    await invalidateMoneyCaches(workspaceId)
  }

  private rethrow(error: unknown): never {
    const code = domainErrorCode(error)
    if (code === 'PAYMENT_NOT_CANCELLABLE') throw new ConflictError(code)
    if (code?.startsWith('PAYMENT_')) throw new ValidationError(code)
    throw error
  }

  // ─── Reads ────────────────────────────────────────────────────────────────

  async listPayments(
    ctx: TenancyContext,
    filters: { partyId?: string; direction?: PaymentDirection; limit?: number } = {},
  ): Promise<PaymentRow[]> {
    return this.repo.listPayments(ctx.workspaceId, filters)
  }

  async getPayment(ctx: TenancyContext, id: string): Promise<PaymentRow> {
    const payment = await this.repo.getPayment(ctx.workspaceId, id)
    if (!payment) throw new NotFoundError('Payment')
    return payment
  }

  /** What a party still owes, invoice by invoice. */
  async getOpenInvoices(ctx: TenancyContext, partyType: PartyType, partyId: string) {
    const invoices = await this.repo.openInvoicesFor(ctx.workspaceId, partyType, partyId)
    return openInvoices(invoices).map((invoice) => ({
      ...invoice,
      outstanding: outstandingOf(invoice),
    }))
  }

  // ─── Recording ────────────────────────────────────────────────────────────

  /**
   * Record money moving, and apply it.
   *
   * With no `allocations`, the payment settles the oldest open invoices first
   * — what a shopkeeper means by "he paid me 500". Anything left over stays on
   * the payment as an advance rather than being refused: a customer paying
   * more than they currently owe is a normal thing, not an error.
   */
  async recordPayment(
    ctx: TenancyContext,
    input: RecordPaymentInput,
    options: { clientRequestId?: string | null } = {},
  ) {
    const clientRequestId = options.clientRequestId ?? null

    // ⚠️ A REPLAYED PAYMENT IS NOT A SECOND PAYMENT. The same key answers with
    // the payment it already recorded. Its journal entry is (re)booked — the
    // ledger is idempotent per payment — in case the first attempt died
    // between the payment and the entry.
    if (clientRequestId) {
      const existingId = await this.repo.paymentIdByClientRequestId(
        ctx.workspaceId,
        clientRequestId,
      )
      if (existingId) return this.replayPayment(ctx, existingId)
    }

    const amount = round2(input.amount)
    const entryDate = (input.entryDate ?? today()).slice(0, 10)

    const explicit = input.allocations && input.allocations.length > 0

    // ─── T9 — WHERE THE CANDIDATE INVOICES COME FROM ────────────────────────
    //
    // Two different questions, and they need two different reads:
    //
    //   no allocations  «what does this party still owe» → oldest first
    //   allocations     «settle THESE invoices»          → by id
    //
    // It used to be only the first. So an explicit allocation to an invoice
    // with no customer — an ordinary walk-in cash sale — was checked against a
    // party list that filters `customer_id = null`, matched nothing, and was
    // refused as PAYMENT_ALLOCATION_INVOICE_UNKNOWN. With no working path,
    // invoice creation wrote `paid_amount` directly instead, and that is the
    // second writer that produced «مبلغ پرداخت‌شده با مجموع پرداخت‌ها یکی
    // نیست» on a real sale.
    const invoices = explicit
      ? await this.repo.openInvoicesByIds(
          ctx.workspaceId,
          input.allocations!.map((a) => a.invoiceId),
        )
      : input.partyId
        ? await this.repo.openInvoicesFor(ctx.workspaceId, input.partyType, input.partyId)
        : []

    // ⚠️ AN INVOICE ADDRESSED BY ID MUST BELONG TO THE PARTY BEING CREDITED.
    //
    // `openInvoicesByIds` is scoped by workspace, which stops cross-tenant
    // settlement. It does NOT stop settling one customer's debt with another
    // customer's money inside the same workspace — both rows are legitimately
    // visible. Nothing else in the chain checks this, so it is checked here.
    if (explicit) {
      for (const invoice of invoices as Array<
        (typeof invoices)[number] & { customerId?: string | null; supplierId?: string | null }
      >) {
        const owner =
          input.partyType === 'customer'
            ? (invoice.customerId ?? null)
            : (invoice.supplierId ?? null)
        const payer = input.partyId ?? null

        // Both null is the walk-in cash sale — the case this change exists to
        // support. A mismatch either way is refused.
        if (owner !== payer) {
          throw new ValidationError('PAYMENT_ALLOCATION_PARTY_MISMATCH')
        }
      }
    }

    const allocations = explicit
      ? input.allocations!.map((a) => ({ invoiceId: a.invoiceId, amount: round2(a.amount) }))
      : autoAllocate(amount, invoices).allocations

    const problems = validateAllocations(amount, allocations, invoices)
    if (problems.length > 0) throw new ValidationError(problems.join(', '))

    const year = Number(entryDate.slice(0, 4))
    const sequence = await this.repo.lastPaymentSequence(ctx.workspaceId, year)
    const paymentNumber = `PMT-${year}-${String(sequence + 1).padStart(6, '0')}`

    let paymentId: string
    let replayed = false
    try {
      ;({ id: paymentId, replayed } = await this.repo.recordPayment(
        ctx,
        {
          paymentNumber,
          direction: input.direction,
          partyType: input.partyType,
          partyId: input.partyId,
          amount,
          currency: input.currency ?? 'AFN',
          method: input.method ?? 'cash',
          entryDate,
          reference: input.reference ?? '',
          notes: input.notes ?? '',
        },
        allocations,
        clientRequestId,
      ))
    } catch (error) {
      const code = (error as { code?: string } | null)?.code
      if (clientRequestId && code === '23505') {
        // A concurrent twin committed first; this attempt rolled back whole.
        const winner = await this.repo.paymentIdByClientRequestId(ctx.workspaceId, clientRequestId)
        if (winner) return this.replayPayment(ctx, winner)
      }
      if (clientRequestId && isMissingIdempotencySupport(error as { code?: string })) {
        throw new IdempotencyUnavailableError('payment')
      }
      this.rethrow(error)
    }

    // The keyed function answered with a payment a twin committed between our
    // lookup and our call: nothing new was written, so nothing is logged twice.
    if (replayed) return this.replayPayment(ctx, paymentId)

    await this.bookPayment(ctx, paymentId, input.direction, amount, entryDate, paymentNumber)

    // Index who took this money. The cancel path reads it back: the person who
    // received a payment is not the person who may erase the record of it.
    await sod.recordAction(ctx, 'payment.record', 'payment', paymentId)

    await this.invalidate(ctx.workspaceId)

    // On the payment, and on every invoice it settles — the invoice's own
    // history is where a person looks for «who took this money».
    for (const target of [
      { entityType: 'payment', entityId: paymentId },
      ...allocations.map((a) => ({ entityType: 'invoice', entityId: a.invoiceId })),
    ]) {
      void logBusinessEvent({
        userId: ctx.userId,
        workspaceId: ctx.workspaceId,
        entityType: target.entityType,
        entityId: target.entityId,
        action: 'payment_recorded',
        title: `پرداخت ${paymentNumber} ثبت شد`,
        metadata: {
          paymentId,
          paymentNumber,
          amount,
          method: input.method ?? 'cash',
          direction: input.direction,
        },
        notify: false,
      })
    }

    const payment = await this.getPayment(ctx, paymentId)
    return { ...payment, unallocated: unallocatedOf(amount, allocations) }
  }

  private async replayPayment(ctx: TenancyContext, paymentId: string) {
    const payment = await this.getPayment(ctx, paymentId)
    await this.bookPayment(
      ctx,
      payment.id,
      payment.direction,
      payment.amount,
      payment.entryDate,
      payment.paymentNumber ?? '',
    )
    const allocated = payment.allocations.reduce((sum, a) => sum + a.amount, 0)
    return asReplay({ ...payment, unallocated: round2(payment.amount - allocated) })
  }

  /**
   * The journal entry behind the payment.
   *
   * Money in:  debit cash or bank, credit receivables — the customer owes less.
   * Money out: debit payables, credit cash or bank — we owe the supplier less.
   *
   * Booked through the ledger port, so it is idempotent per payment and cannot
   * be written twice by a retry. A chart of accounts that cannot express it
   * yet leaves the payment recorded and says so, rather than refusing to take
   * the customer's money.
   */
  private async bookPayment(
    ctx: TenancyContext,
    paymentId: string,
    direction: PaymentDirection,
    amount: number,
    entryDate: string,
    paymentNumber: string,
  ) {
    const isIncoming = direction === 'in'
    const needed = isIncoming ? (['cash', 'receivable'] as const) : (['payable', 'cash'] as const)

    const { accounts, missing } = await ledger.ensureAccountsForRoles(ctx, [...needed])

    if (missing.length > 0) {
      console.warn(
        `[Payments] payment ${paymentId} not booked: no account for ${missing.join(', ')}`,
      )
      return
    }

    const outcome = await ledger.postDocument(ctx, {
      sourceType: 'payment',
      sourceId: paymentId,
      date: entryDate,
      description: `${isIncoming ? 'دریافت' : 'پرداخت'} ${paymentNumber}`,
      reference: paymentNumber,
      lines: isIncoming
        ? [
            { accountId: accounts.cash!, debit: amount, credit: 0 },
            { accountId: accounts.receivable!, debit: 0, credit: amount },
          ]
        : [
            { accountId: accounts.payable!, debit: amount, credit: 0 },
            { accountId: accounts.cash!, debit: 0, credit: amount },
          ],
    })

    if (outcome.status === 'posted' || outcome.status === 'already_posted') {
      await this.repo.attachJournalEntry(ctx.workspaceId, paymentId, outcome.entryId)
    }
  }

  /**
   * Cancel a payment: reopen the invoices it settled and reverse its entry.
   *
   * The payment row stays, marked cancelled. Money that was taken and then
   * given back is two events; deleting the first would leave the books saying
   * it never happened.
   */
  async cancelPayment(
    ctx: TenancyContext,
    paymentId: string,
    reason: string,
    override?: { reason: string } | undefined,
  ) {
    const payment = await this.getPayment(ctx, paymentId)
    if (payment.status !== 'posted') throw new ConflictError('PAYMENT_NOT_CANCELLABLE')

    // ═══════════════════════════════════════════════════════════════════════
    // ⚠️ RECORD SCOPE — THE RULE WAS DECLARED AND NEVER ASKED HERE.
    //
    // `scope.service.ts` lists `payment` in its SHAPE table with both a branch
    // and an owner column, and every other guarded resource calls it:
    // invoice.update, invoice.delete, customer.write, product.write. Cancelling
    // a payment — the most destructive thing this service does, since it
    // reverses a posted ledger entry — was the one that did not.
    //
    // `getPayment` above filters by `workspace_id` alone, so tenancy was never
    // broken. What was missing is the delegation INSIDE a workspace: a member
    // pinned to the Kabul branch could cancel a Herat payment by knowing its
    // id, and the branch rule applies to managers and owners too — it is not a
    // seller-only restriction.
    //
    // The SoD check below is a DIFFERENT control and does not cover this. It
    // asks «did you record this yourself», not «is this yours to touch»: a
    // manager cancelling a colleague's payment in another branch passes SoD
    // cleanly.
    //
    // Order matters. Scope first: being told «you cannot act on another
    // branch's records» is the accurate refusal, and reaching the
    // maker-checker rule first would report the wrong reason and offer an
    // override for a control that was not the obstacle.
    // ═══════════════════════════════════════════════════════════════════════
    await scopes.assertMay(ctx, 'payment', paymentId, 'payment.cancel')

    // Refused if this actor recorded the payment and the workspace enforces
    // the separation. Throws with the rule id, so the client can say which
    // control refused and offer the override where one is available.
    await sod.assertAllowed(ctx, 'payment.cancel', 'payment', paymentId, override)

    try {
      await this.repo.cancelPayment(ctx, paymentId)
    } catch (error) {
      this.rethrow(error)
    }

    await sod.recordAction(ctx, 'payment.cancel', 'payment', paymentId)

    await ledger
      .reverseDocument(ctx, 'payment', paymentId, { reason })
      .catch((err) => console.error(`[Payments] reversal failed for ${paymentId}:`, err))

    await this.invalidate(ctx.workspaceId)

    void logBusinessEvent({
      userId: ctx.userId,
      workspaceId: ctx.workspaceId,
      entityType: 'payment',
      entityId: paymentId,
      action: 'cancelled',
      title: 'پرداخت لغو شد',
      metadata: { reason },
      notify: false,
    })

    return this.getPayment(ctx, paymentId)
  }

  // ─── Reports ──────────────────────────────────────────────────────────────

  /** Receivables aging, by bucket and by party. */
  async getAging(
    ctx: TenancyContext,
    kind: 'receivable' | 'payable',
    asOf: string = today(),
  ): Promise<{
    asOf: string
    totals: AgingBuckets
    parties: Array<{ partyId: string | null; buckets: AgingBuckets }>
  }> {
    const cacheKey = `payments:${ctx.workspaceId}:aging:${kind}:${asOf}`

    const cached = await memoryCache.get<{
      asOf: string
      totals: AgingBuckets
      parties: Array<{ partyId: string | null; buckets: AgingBuckets }>
    }>(cacheKey)
    if (cached) return cached

    const rows = await this.repo.allOpenInvoices(
      ctx.workspaceId,
      kind === 'receivable' ? 'sale' : 'purchase',
    )

    const byParty = new Map<string, OpenInvoice[]>()
    for (const row of rows) {
      const key = row.partyId ?? 'unassigned'
      const list = byParty.get(key) ?? []
      list.push(row)
      byParty.set(key, list)
    }

    const parties = [...byParty.entries()].map(([partyId, invoices]) => ({
      partyId: partyId === 'unassigned' ? null : partyId,
      buckets: ageInvoices(invoices, asOf),
    }))

    const totals = parties.reduce((acc, party) => {
      acc.current = round2(acc.current + party.buckets.current)
      acc.days1to30 = round2(acc.days1to30 + party.buckets.days1to30)
      acc.days31to60 = round2(acc.days31to60 + party.buckets.days31to60)
      acc.days61to90 = round2(acc.days61to90 + party.buckets.days61to90)
      acc.over90 = round2(acc.over90 + party.buckets.over90)
      acc.total = round2(acc.total + party.buckets.total)
      return acc
    }, emptyAging())

    const result = {
      asOf,
      totals,
      parties: parties.sort((a, b) => b.buckets.total - a.buckets.total),
    }

    await memoryCache.set(cacheKey, result, 120)
    return result
  }

  /**
   * A party's statement: every invoice and payment, with a running balance.
   *
   * Positive means they owe us. The balance this replaces added receipts to
   * the customer's debt, so taking money from a customer made them owe MORE.
   */
  async getPartyLedger(ctx: TenancyContext, partyType: PartyType, partyId: string) {
    const { invoices, payments, openingBalance } = await this.repo.partyMovements(
      ctx.workspaceId,
      partyType,
      partyId,
    )

    // Each row keeps what the statement needs to link back to its document.
    const sources = new Map<
      string,
      { sourceType: 'invoice' | 'payment'; sourceId: string; currency: string; method?: string }
    >()
    const movements: LedgerMovement[] = [
      ...invoices.map((invoice) => {
        const reference = invoice.invoice_number ?? invoice.id
        sources.set(`i:${invoice.id}`, {
          sourceType: 'invoice',
          sourceId: invoice.id,
          currency: invoice.currency ?? '',
        })
        return {
          date: String(invoice.date ?? '').slice(0, 10),
          kind: (invoice.type === 'purchase' ? 'purchase' : 'sale') as LedgerMovement['kind'],
          amount: Number(invoice.total) || 0,
          reference,
          key: `i:${invoice.id}`,
        }
      }),
      ...payments.map((payment) => {
        sources.set(`p:${payment.id}`, {
          sourceType: 'payment',
          sourceId: payment.id,
          currency: payment.currency ?? '',
          method: payment.method ?? undefined,
        })
        return {
          date: String(payment.entry_date ?? '').slice(0, 10),
          kind: (payment.direction === 'in'
            ? 'payment_in'
            : 'payment_out') as LedgerMovement['kind'],
          amount: Number(payment.amount) || 0,
          reference: payment.payment_number ?? payment.id,
          key: `p:${payment.id}`,
        }
      }),
    ]

    // The running balance starts from the opening balance, not from zero.
    const opening = round2(openingBalance)
    return {
      partyType,
      partyId,
      openingBalance: opening,
      movements: runningLedger(movements).map((row) => {
        const { key, ...rest } = row as typeof row & { key: string }
        return { ...rest, balance: round2(rest.balance + opening), ...sources.get(key) }
      }),
      balance: round2(partyBalance(movements) + opening),
    }
  }

  /**
   * Customer 360 money summary — the authoritative figures for the party page.
   * The page must not add invoices up in the browser: it used to read the first
   * 200 invoices of the whole workspace and total those.
   */
  async getPartySummary(
    ctx: TenancyContext,
    partyType: PartyType,
    partyId: string,
    asOf: string = today(),
  ): Promise<PartySummary> {
    const { invoices, payments, openingBalance } = await this.repo.partyMovements(
      ctx.workspaceId,
      partyType,
      partyId,
    )
    return summarizeParty(
      invoices.map((invoice) => ({
        id: invoice.id,
        type: invoice.type === 'purchase' ? 'purchase' : 'sale',
        status: String(invoice.status ?? ''),
        total: Number(invoice.total) || 0,
        paidAmount: Number(invoice.paid_amount) || 0,
        invoiceDate: String(invoice.date ?? '').slice(0, 10),
        dueDate: String(invoice.due_date ?? '').slice(0, 10),
        currency: String(invoice.currency ?? ''),
      })),
      payments.map((payment) => ({
        direction: payment.direction === 'out' ? 'out' : 'in',
        amount: Number(payment.amount) || 0,
        entryDate: String(payment.entry_date ?? '').slice(0, 10),
        currency: String(payment.currency ?? ''),
      })),
      asOf,
      openingBalance,
    )
  }
}
