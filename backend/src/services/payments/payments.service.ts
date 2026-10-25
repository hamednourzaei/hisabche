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

import { baseCurrencyOf } from '../base-currency'
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
import { tillForPayment } from '../pos/till-choice'

import {
  ageInvoices,
  autoAllocate,
  emptyAging,
  openInvoices,
  outstandingOf,
  partyBalance,
  round2,
  runningLedger,
  monthlyActivity,
  rankPartyProducts,
  summarizeParty,
  unallocatedOf,
  settlesInCurrency,
  paymentPosting,
  cashMovedOf,
  tillAmountMinor,
  type PaymentPosting,
  validateAllocations,
  type AgingBuckets,
  type AllocationRequest,
  type LedgerMovement,
  type OpenInvoice,
  type PartyType,
  type MonthlyActivity,
  type PartyProduct,
  type PartySummary,
  type PaymentDirection,
  partyBalancesByCurrency,
  summarizePartyByCurrency,
  type SummaryInvoice,
  type SummaryPayment,
  moneyAccountRole,
} from './payments.domain'
import {
  buildOpenInvoicesView,
  buildPartyActivity,
  buildPartyLedger,
  buildPartySummary,
  partyActivityInvoices,
} from '@hisabche/validation'
import { PaymentsRepository, domainErrorCode, type PaymentRow } from './payments.repository'

export interface RecordPaymentInput {
  direction: PaymentDirection
  partyType: PartyType
  /** null only for a walk-in invoice, and then allocations must name it. */
  partyId: string | null
  amount: number
  entryDate?: string | undefined
  currency?: string | undefined
  /** Books currency per one unit of `currency`. Needed when they differ and no settled invoice carries one. */
  exchangeRate?: number | undefined
  method?: string | undefined
  reference?: string | undefined
  notes?: string | undefined
  /** Omit to settle the oldest open invoices first. */
  allocations?: AllocationRequest[] | undefined
  /**
   * The till this cash goes into (money in) or comes out of (money out).
   * A REQUEST: the till is read and checked on the server. Cash only.
   * Absent = no till is touched — nothing is inferred from who recorded it.
   */
  tillSessionId?: string | null | undefined
  /**
   * What a bank or money changer kept, in the payment's currency. Money in:
   * the business received `amount - feeAmount`. Money out: it paid
   * `amount + feeAmount`. The party's debt is settled by `amount` either way.
   */
  feeAmount?: number | undefined
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
    return buildOpenInvoicesView(
      await this.repo.openInvoicesFor(ctx.workspaceId, partyType, partyId),
    )
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
    options: {
      clientRequestId?: string | null
      /**
       * Called once the payment and its journal entry exist, with the posting
       * the core derived and the facts it derived it from.
       *
       * ⚠️ DIAGNOSTIC ONLY — shadow verification. It cannot change, reject or
       * repeat the payment; a hook that could would be a second authority over
       * money, which is the thing being audited.
       */
      onPosted?: (posted: {
        posting: ReturnType<typeof paymentPosting>
        facts: {
          direction: PaymentDirection
          amount: number
          paymentRate: number
          allocations: { amount: number; rate: number | null }[]
          fee: number
        }
      }) => void
    } = {},
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
    const bookCurrency = await baseCurrencyOf(ctx.workspaceId)
    const currency = input.currency ?? bookCurrency

    const candidates = explicit
      ? await this.repo.openInvoicesByIds(
          ctx.workspaceId,
          input.allocations!.map((a) => a.invoiceId),
        )
      : input.partyId
        ? await this.repo.openInvoicesFor(ctx.workspaceId, input.partyType, input.partyId)
        : []

    // ─── A PAYMENT SETTLES INVOICES OF ITS OWN CURRENCY (DEFECT-CUR-03) ─────
    //
    // Named invoices in another currency are REFUSED: the person asked for
    // something that cannot be done, and must be told. With no invoice named
    // («he paid me 500»), the money goes to what the party owes in that
    // currency and the rest stays as credit — an afghani payment never eats a
    // dollar debt because it happened to be the oldest.
    if (
      explicit &&
      candidates.some((invoice) => !settlesInCurrency(invoice, currency, bookCurrency))
    ) {
      throw new ValidationError('PAYMENT_ALLOCATION_CURRENCY_MISMATCH')
    }
    const invoices = candidates.filter((invoice) =>
      settlesInCurrency(invoice, currency, bookCurrency),
    )

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

    // Decided BEFORE anything is written: a payment in another currency with
    // no rate to book it at is refused, not recorded and left out of the books.
    const bookingRate = await this.bookingRate(
      ctx,
      currency,
      bookCurrency,
      input.exchangeRate,
      allocations.map((a) => a.invoiceId),
    )
    if (bookingRate === null) throw new ValidationError('PAYMENT_EXCHANGE_RATE_REQUIRED')

    const fee = input.feeAmount && input.feeAmount > 0 ? round2(input.feeAmount) : 0
    // A fee taken out of money received cannot be all of it.
    if (fee > 0 && input.direction === 'in' && fee >= amount) {
      throw new ValidationError('PAYMENT_FEE_EXCEEDS_AMOUNT')
    }

    // Also decided before anything is written: a till that is closed, of
    // another branch, or that cannot count this money refuses the payment.
    // The drawer moves by what actually passed through it — net of the fee.
    const till = input.tillSessionId
      ? await this.tillMovement(ctx, input.tillSessionId, {
          method: input.method ?? 'cash',
          amount: cashMovedOf(input.direction, amount, fee),
          currency,
          bookCurrency,
          rate: bookingRate,
        })
      : null

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
          currency,
          method: input.method ?? 'cash',
          entryDate,
          reference: input.reference ?? '',
          notes: input.notes ?? '',
        },
        allocations,
        clientRequestId,
        till,
        fee > 0 ? fee : null,
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

    // The facts the posting is derived FROM, kept beside the posting itself so
    // the shadow check can re-derive from the same operands rather than from
    // the answer.
    const postingFacts = {
      direction: input.direction,
      amount,
      paymentRate: bookingRate,
      allocations: await this.allocationRates(ctx, currency, bookCurrency, allocations),
      fee,
    }
    const posting = paymentPosting(postingFacts)

    await this.bookPayment(
      ctx,
      paymentId,
      input.direction,
      input.method ?? 'cash',
      posting,
      entryDate,
      paymentNumber,
    )

    // Diagnostic only: see `onPosted`. Bound after the write, so a hook that
    // throws cannot undo a payment that already exists.
    options.onPosted?.({ posting, facts: postingFacts })

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
    return {
      ...payment,
      unallocated: unallocatedOf(amount, allocations),
      tillSessionId: till?.sessionId ?? null,
    }
  }

  /**
   * Would this till take this cash? Asked by a caller that is about to write
   * something else first (an invoice) and must not find out afterwards.
   * Throws exactly what recording the payment would.
   */
  async assertTillTakes(
    ctx: TenancyContext,
    tillSessionId: string,
    money: { method: string; amount: number; currency?: string | undefined; rate: number },
  ): Promise<void> {
    const bookCurrency = await baseCurrencyOf(ctx.workspaceId)
    await this.tillMovement(ctx, tillSessionId, {
      method: money.method,
      amount: round2(money.amount),
      currency: money.currency ?? bookCurrency,
      bookCurrency,
      rate: money.rate,
    })
  }

  private async tillMovement(
    ctx: TenancyContext,
    tillSessionId: string,
    money: { method: string; amount: number; currency: string; bookCurrency: string; rate: number },
  ): Promise<{ sessionId: string; amountMinor: number }> {
    // A transfer or a card never passed through a drawer.
    if (money.method !== 'cash') throw new ValidationError('PAYMENT_TILL_ONLY_CASH')
    const till = await tillForPayment(ctx, tillSessionId)
    const amountMinor = tillAmountMinor({
      amount: money.amount,
      currency: money.currency,
      tillCurrency: till.currency ?? money.bookCurrency,
      bookCurrency: money.bookCurrency,
      rate: money.rate,
    })
    if (amountMinor === null) throw new ValidationError('PAYMENT_TILL_CURRENCY_MISMATCH')
    return { sessionId: till.id, amountMinor }
  }

  /**
   * Each allocation with the rate its invoice was booked at (null = none of
   * its own). In the books currency there is no rate to differ.
   */
  private async allocationRates(
    ctx: TenancyContext,
    currency: string,
    bookCurrency: string,
    allocations: ReadonlyArray<{ invoiceId: string; amount: number }>,
  ): Promise<Array<{ amount: number; rate: number | null }>> {
    if (currency === bookCurrency || allocations.length === 0) {
      return allocations.map((a) => ({ amount: a.amount, rate: null }))
    }
    const rates = await this.repo.invoiceRatesById(
      ctx.workspaceId,
      allocations.map((a) => a.invoiceId),
    )
    return allocations.map((a) => ({ amount: a.amount, rate: rates?.get(a.invoiceId) ?? null }))
  }

  /**
   * The account an exchange difference is booked to, or null when this
   * database cannot hold one yet (till-payments-01 not run: the role is
   * refused by the CHECK). The payment is then booked as it always was.
   */
  private async exchangeDifferenceAccount(ctx: TenancyContext): Promise<string | null> {
    return this.accountForRole(ctx, 'fx_gain_loss')
  }

  private async accountForRole(
    ctx: TenancyContext,
    role: 'fx_gain_loss' | 'bank_fees',
  ): Promise<string | null> {
    try {
      const { accounts } = await ledger.ensureAccountsForRoles(ctx, [role])
      return accounts[role] ?? null
    } catch (error) {
      console.warn(`[Payments] no account for ${role}:`, error)
      return null
    }
  }

  /**
   * The rate a payment is booked at: books currency per one unit of its own.
   *
   *   · the books currency                    → 1
   *   · a rate given with the payment         → that
   *   · every invoice it settles has ONE rate → that, so the receivable or
   *     payable the invoice opened is closed by exactly the same amount
   *   · otherwise                             → null: nothing to book it at
   *
   * This is the rate of the MONEY. When it differs from the rate of an
   * invoice it settles, `paymentPosting` books the difference as a gain or a
   * loss.
   */
  private async bookingRate(
    ctx: TenancyContext,
    currency: string,
    bookCurrency: string,
    given: number | undefined,
    invoiceIds: string[],
  ): Promise<number | null> {
    if (currency === bookCurrency) return 1
    if (typeof given === 'number' && given > 0 && Number.isFinite(given)) return given
    if (invoiceIds.length === 0) return null
    const read = await this.repo.invoiceExchangeRates(ctx.workspaceId, invoiceIds)
    // No column = no invoice of this database carries a rate.
    if (read === null) return null
    const rates = new Set(read)
    if (rates.size !== 1) return null
    const [rate] = [...rates]
    return typeof rate === 'number' && rate > 0 ? rate : null
  }

  private async replayPayment(ctx: TenancyContext, paymentId: string) {
    const payment = await this.getPayment(ctx, paymentId)
    const bookCurrency = await baseCurrencyOf(ctx.workspaceId)
    const rate = await this.bookingRate(
      ctx,
      payment.currency || bookCurrency,
      bookCurrency,
      undefined,
      payment.allocations.map((a) => a.invoiceId),
    )
    // Already booked → the ledger answers «already posted» whatever is passed.
    // Never booked and no rate to be found → left unbooked, and said.
    if (rate === null) {
      console.warn(`[Payments] payment ${paymentId} replayed with no rate to book it at`)
      const allocatedNow = payment.allocations.reduce((sum, a) => sum + a.amount, 0)
      return asReplay({ ...payment, unallocated: round2(payment.amount - allocatedNow) })
    }
    // A replay that has to book (the first attempt died before the entry)
    // no longer knows a rate given with the request, so it claims no
    // difference: both sides at the one rate it can find.
    await this.bookPayment(
      ctx,
      payment.id,
      payment.direction,
      payment.method ?? 'cash',
      paymentPosting({
        direction: payment.direction,
        amount: payment.amount,
        paymentRate: rate,
        allocations: [],
        fee: await this.repo.feeOf(ctx.workspaceId, payment.id),
      }),
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
    method: string,
    posting: PaymentPosting,
    entryDate: string,
    paymentNumber: string,
  ) {
    const isIncoming = direction === 'in'
    // ⚠️ Where the money is: cash in the drawer, anything else in the bank —
    // the same split the till close makes for card and transfer takings. A
    // «بانکی / حواله» payment was debited to صندوق on the live site (14 Oct),
    // so the bank account never moved and the drawer read 3,000 too high.
    const moneyRole = moneyAccountRole(method)
    const needed = isIncoming
      ? ([moneyRole, 'receivable'] as const)
      : (['payable', moneyRole] as const)

    const { accounts, missing } = await ledger.ensureAccountsForRoles(ctx, [...needed])

    if (missing.length > 0) {
      console.warn(
        `[Payments] payment ${paymentId} not booked: no account for ${missing.join(', ')}`,
      )
      return
    }

    // The exchange difference needs its own account. Without one (the
    // migration not run) the debt is closed by the cash figure, as before —
    // said in the log, never dropped silently into another account.
    const differenceAccount =
      posting.difference !== 0 ? await this.exchangeDifferenceAccount(ctx) : null
    if (posting.difference !== 0 && !differenceAccount) {
      console.warn(
        `[Payments] payment ${paymentId}: exchange difference ${posting.difference} not recognised`,
      )
    }
    // The fee, likewise, needs its account. Without one the cash is booked
    // gross — the entry stays balanced and the log says what was left out.
    const feeAccount = posting.fee > 0 ? await this.accountForRole(ctx, 'bank_fees') : null
    if (posting.fee > 0 && !feeAccount) {
      console.warn(`[Payments] payment ${paymentId}: fee ${posting.fee} not booked`)
    }
    const gross = round2(isIncoming ? posting.cash + posting.fee : posting.cash - posting.fee)
    const cash = feeAccount ? posting.cash : gross
    const feeLine = feeAccount ? [{ accountId: feeAccount, debit: posting.fee, credit: 0 }] : []
    const party = differenceAccount ? posting.party : gross
    const difference = differenceAccount ? posting.difference : 0
    const differenceLine =
      differenceAccount && difference !== 0
        ? [
            difference > 0
              ? { accountId: differenceAccount, debit: 0, credit: difference }
              : { accountId: differenceAccount, debit: -difference, credit: 0 },
          ]
        : []

    const outcome = await ledger.postDocument(ctx, {
      sourceType: 'payment',
      sourceId: paymentId,
      date: entryDate,
      description: `${isIncoming ? 'دریافت' : 'پرداخت'} ${paymentNumber}`,
      reference: paymentNumber,
      lines: isIncoming
        ? [
            { accountId: accounts[moneyRole]!, debit: cash, credit: 0 },
            ...feeLine,
            { accountId: accounts.receivable!, debit: 0, credit: party },
            ...differenceLine,
          ]
        : [
            { accountId: accounts.payable!, debit: party, credit: 0 },
            ...feeLine,
            { accountId: accounts[moneyRole]!, debit: 0, credit: cash },
            ...differenceLine,
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
   * Positive means they owe us. The assembly is the shared rule
   * (`buildPartyLedger`) — the device builds the same statement with it.
   */
  async getPartyLedger(ctx: TenancyContext, partyType: PartyType, partyId: string) {
    const rows = await this.repo.partyMovements(ctx.workspaceId, partyType, partyId)
    return buildPartyLedger({
      partyType,
      partyId,
      rows,
      bookCurrency: await baseCurrencyOf(ctx.workspaceId),
    })
  }

  /**
   * Customer 360 money summary — the authoritative figures for the party page.
   * The page must not add invoices up in the browser.
   */
  async getPartySummary(
    ctx: TenancyContext,
    partyType: PartyType,
    partyId: string,
    asOf: string = today(),
  ) {
    const rows = await this.repo.partyMovements(ctx.workspaceId, partyType, partyId)
    return buildPartySummary({
      rows,
      bookCurrency: await baseCurrencyOf(ctx.workspaceId),
      asOf,
    })
  }

  /**
   * Customer 360 activity: sales vs receipts for the last 12 months, and the
   * products this party buys (or supplies) most, by amount.
   */
  async getPartyActivity(
    ctx: TenancyContext,
    partyType: PartyType,
    partyId: string,
    asOf: string = today(),
  ): Promise<{ monthly: MonthlyActivity[]; products: PartyProduct[] }> {
    const rows = await this.repo.partyMovements(ctx.workspaceId, partyType, partyId)
    const lines = await this.repo.invoiceLines(
      ctx.workspaceId,
      partyActivityInvoices(partyType, rows.invoices).map((invoice) => invoice.id),
    )
    return buildPartyActivity({ partyType, rows, lines, asOf })
  }
}
