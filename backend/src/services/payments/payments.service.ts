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
import { ValidationError } from '../../errors/validation.error'
import { memoryCache } from '../../utils/pagination'
import type { TenancyContext } from '../tenancy.service'
import { ledger } from '../accounting'
import { scopes, sod } from '../authorization'

import {
  ageInvoices,
  autoAllocate,
  emptyAging,
  openInvoices,
  outstandingOf,
  partyBalance,
  round2,
  runningLedger,
  unallocatedOf,
  validateAllocations,
  type AgingBuckets,
  type AllocationRequest,
  type LedgerMovement,
  type OpenInvoice,
  type PartyType,
  type PaymentDirection,
} from './payments.domain'
import { PaymentsRepository, domainErrorCode, type PaymentRow } from './payments.repository'

export interface RecordPaymentInput {
  direction: PaymentDirection
  partyType: PartyType
  partyId: string
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
    await memoryCache.invalidate(`payments:${workspaceId}`)
    // An invoice's outstanding balance and the debt report both change with
    // every payment, and they live under other prefixes.
    await memoryCache.invalidate(`invoices:${workspaceId}`)
    await memoryCache.invalidate(`accounting:${workspaceId}`)
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
  async recordPayment(ctx: TenancyContext, input: RecordPaymentInput) {
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
      : await this.repo.openInvoicesFor(ctx.workspaceId, input.partyType, input.partyId)

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
    try {
      paymentId = await this.repo.recordPayment(
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
      )
    } catch (error) {
      this.rethrow(error)
    }

    await this.bookPayment(ctx, paymentId, input.direction, amount, entryDate, paymentNumber)

    // Index who took this money. The cancel path reads it back: the person who
    // received a payment is not the person who may erase the record of it.
    await sod.recordAction(ctx, 'payment.record', 'payment', paymentId)

    await this.invalidate(ctx.workspaceId)

    const payment = await this.getPayment(ctx, paymentId)
    return { ...payment, unallocated: unallocatedOf(amount, allocations) }
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

    const { accounts, missing } = await ledger.resolveAccountsByRole(ctx, [...needed])

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
    const { invoices, payments } = await this.repo.partyMovements(
      ctx.workspaceId,
      partyType,
      partyId,
    )

    const movements: LedgerMovement[] = [
      ...invoices.map((invoice: Record<string, any>) => ({
        date: String(invoice.date ?? '').slice(0, 10),
        kind: (invoice.type === 'purchase' ? 'purchase' : 'sale') as LedgerMovement['kind'],
        amount: Number(invoice.total) || 0,
        reference: invoice.invoice_number ?? invoice.id,
      })),
      ...payments.map((payment: Record<string, any>) => ({
        date: String(payment.entry_date ?? '').slice(0, 10),
        kind: (payment.direction === 'in' ? 'payment_in' : 'payment_out') as LedgerMovement['kind'],
        amount: Number(payment.amount) || 0,
        reference: payment.payment_number ?? payment.id,
      })),
    ]

    return {
      partyType,
      partyId,
      movements: runningLedger(movements),
      balance: partyBalance(movements),
    }
  }
}
