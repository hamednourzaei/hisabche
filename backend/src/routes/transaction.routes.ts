// ============================================
// backend/src/routes/transaction.routes.ts
// ============================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { supabase } from '../db'
import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { cacheMiddleware, clearCache } from '../middleware/cache.middleware'
import {
  summarise,
  type LedgerTxn,
  type PartySide,
} from '../services/accounting/party-ledger.domain'
// The payments core: the one place money moving between the business and a
// party is recorded. `payments` is the shared instance the rest of the backend
// books through — see services/payments/index.ts.
import { partyBalance, payments as paymentsService } from '../services/payments'
import { BaseError } from '../errors/base.error'
import {
  IdempotencyUnavailableError,
  isMissingIdempotencySupport,
  readClientRequestId,
} from '../utils/client-request'

// ─── Types ────────────────────────────────────────────────
interface CreateTransactionBody {
  customerId?: string
  supplierId?: string
  type: 'sale' | 'purchase' | 'payment' | 'receipt' | 'return'
  amount: number
  currency?: string
  description?: string
  reference?: string
  date?: string
}

// ─── Routes ───────────────────────────────────────────────
export async function transactionRoutes(fastify: FastifyInstance) {
  // ─── GET /api/transactions/ledger ────────────────────────
  //
  // A running account for one customer or one supplier.
  //
  // ⚠️ Registered BEFORE `/:id` in this file, because Fastify would otherwise
  // be free to read "ledger" as a transaction id.
  //
  // Was in KNOWN_MISSING — `useLedger()` has called this address since it was
  // written and got a 404, so every party statement rendered empty. The
  // arithmetic lives in `party-ledger.domain.ts` so the direction rule (a sale
  // debits a customer; a purchase CREDITS a supplier) is testable without a
  // database. Getting that backwards produces no error — only a statement that
  // is wrong by twice the amount.
  fastify.get(
    '/api/transactions/ledger',
    { preHandler: [authenticate, requireWorkspaceContext] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { customerId, supplierId } = request.query as {
          customerId?: string
          supplierId?: string
        }

        // Exactly one. Both would sum two unrelated accounts into a statement
        // that balances to nothing meaningful; neither has no subject at all.
        if ((customerId && supplierId) || (!customerId && !supplierId)) {
          return reply.code(400).send({ error: 'LEDGER_ONE_PARTY_REQUIRED' })
        }

        const side: PartySide = customerId ? 'customer' : 'supplier'
        const column = customerId ? 'customer_id' : 'supplier_id'
        const partyId = (customerId ?? supplierId) as string

        // PHASE B — `transactions_view`, not the `transactions` table.
        //
        // The table contains neither the invoices nor the payments: nothing
        // writes a row there when an invoice is issued or when money is taken
        // through the payments core. A statement built from it was a statement
        // of the two things that DO write there — an opening balance and a
        // manual adjustment — presented as the party's whole account.
        //
        // The view is the union of posted invoices, posted payments, and the
        // legacy rows no document stands behind. Same columns, real contents.
        const { data, error } = await supabase
          .from('transactions_view')
          .select('type, amount, created_at')
          .eq('workspace_id', request.tenancy.workspaceId)
          .eq(column, partyId)
          .order('created_at', { ascending: true })
          .limit(10_000)

        if (error) throw error

        // `transactions.amount` is stored in MAJOR units. The domain works in
        // minor units so a few hundred rows do not drift by cents — a customer
        // statement that disagrees with the invoice by one afghani is a phone
        // call. Converted here and converted back at the response edge.
        const transactions: LedgerTxn[] = (data ?? []).map((row: Record<string, any>) => ({
          type: row.type,
          amountMinor: Math.round((Number(row.amount) || 0) * 100),
          at: String(row.created_at ?? ''),
        }))

        // What the party carried in before any of these. `customers` records
        // it; a supplier has no such column, so it starts at zero rather than
        // being invented.
        let openingMinor = 0
        if (customerId) {
          const { data: customer } = await supabase
            .from('customers')
            .select('opening_balance')
            .eq('workspace_id', request.tenancy.workspaceId)
            .eq('id', customerId)
            .maybeSingle()

          openingMinor = Math.round((Number(customer?.opening_balance) || 0) * 100)
        }

        const summary = summarise(side, openingMinor, transactions)

        return reply.send({
          ...(customerId ? { customerId } : { supplierId }),
          openingBalance: summary.openingBalanceMinor / 100,
          totalDebit: summary.totalDebitMinor / 100,
          totalCredit: summary.totalCreditMinor / 100,
          closingBalance: summary.closingBalanceMinor / 100,
        })
      } catch (err) {
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to build the ledger' })
      }
    },
  )

  // GET /api/transactions
  fastify.get(
    '/api/transactions',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        cacheMiddleware({ scope: 'workspace', ttl: 60, keyPrefix: 'transactions' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const q = request.query as Record<string, string>
      const customerId = q.customerId ?? ''
      const supplierId = q.supplierId ?? ''
      const type = q.type ?? ''
      const page = Math.max(1, parseInt(q.page ?? '1'))
      const limit = Math.min(100, parseInt(q.limit ?? '20'))
      const from = (page - 1) * limit
      const to = from + limit - 1

      // ⚠️ SECURITY — this query had NO tenancy filter of any kind. Any
      // authenticated user received EVERY transaction in the database, from every
      // business on the platform. The workspace filter is the whole fix.
      const { workspaceId } = request.tenancy

      // PHASE B — the view, for the same reason as the ledger route above.
      // Ordered by `created_at`, which the view carries; the table's `date`
      // column does not exist on it because a payment dates itself by
      // `entry_date` and an invoice by `date`, and the view has already picked
      // the right one for each source.
      let query = supabase
        .from('transactions_view')
        .select('*', { count: 'exact' })
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .range(from, to)

      if (customerId) query = query.eq('customer_id', customerId)
      if (supplierId) query = query.eq('supplier_id', supplierId)
      if (type) query = query.eq('type', type)

      const { data, error, count } = await query

      if (error) {
        fastify.log.error(error)
        return reply.code(500).send({ error: error.message })
      }

      return { transactions: data ?? [], total: count ?? 0, page, limit }
    },
  )

  // POST /api/transactions
  fastify.post(
    '/api/transactions',
    {
      preHandler: [authenticate, requireWorkspaceContext],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as CreateTransactionBody
      const { workspaceId, userId } = request.tenancy
      const clientRequestId = readClientRequestId(request)

      if (!body.amount || body.amount <= 0) {
        return reply.code(400).send({ error: 'مبلغ معتبر نیست' })
      }

      if (!body.customerId && !body.supplierId) {
        return reply.code(400).send({ error: 'مشتری یا تأمین‌کننده الزامی است' })
      }

      // ─── PHASE B — money movement is redirected to the payments core ──────
      //
      // 'payment' and 'receipt' used to be written straight into this table.
      // What that produced: a row that settles no invoice, appears in no
      // journal entry, and is therefore absent from the trial balance, the
      // income statement and `invoice_outstanding` — while moving the number on
      // the customer screen. Two financial truths, disagreeing.
      //
      // It was also getting the DIRECTION wrong. The web PaymentModal sent
      // `type: 'payment'` for money RECEIVED from a customer, and 'payment' in
      // the party-ledger vocabulary means money paid OUT. Every customer
      // payment moved the balance the wrong way by twice its amount.
      //
      // So it is not passed through — it is RECORDED PROPERLY. The payments
      // core allocates the amount against that party's open invoices (oldest
      // first) and books the journal entry, both of which this route could
      // never do. The response keeps the old shape so existing callers survive
      // the change.
      if (body.type === 'payment' || body.type === 'receipt') {
        try {
          const isCustomer = Boolean(body.customerId)

          // Direction is derived from WHO the party is, not from the caller's
          // `type` — the caller is the thing that has been getting it wrong.
          // Money involving a customer comes in; money involving a supplier
          // goes out.
          const payment = await paymentsService.recordPayment(
            request.tenancy,
            {
              direction: isCustomer ? 'in' : 'out',
              partyType: isCustomer ? 'customer' : 'supplier',
              partyId: (body.customerId ?? body.supplierId) as string,
              amount: body.amount,
              ...(body.currency ? { currency: body.currency } : {}),
              ...(body.date ? { entryDate: body.date.slice(0, 10) } : {}),
              ...(body.reference ? { reference: body.reference } : {}),
              ...(body.description ? { notes: body.description } : {}),
            },
            { clientRequestId },
          )

          await clearCache(`transactions:${workspaceId}:*`)
          await clearCache(`transaction-balance:${workspaceId}:*`)
          await clearCache(`dashboard:${workspaceId}`)
          await clearCache(`sales:${workspaceId}:*`)

          const replayed = (payment as { idempotentReplay?: boolean }).idempotentReplay === true
          if (replayed) reply.header('idempotent-replay', 'true')
          return reply.code(replayed ? 200 : 201).send({
            id: payment.id,
            customer_id: isCustomer ? body.customerId : null,
            supplier_id: isCustomer ? null : body.supplierId,
            type: isCustomer ? 'receipt' : 'payment',
            amount: body.amount,
            currency: payment.currency,
            description: body.description ?? '',
            reference: body.reference ?? '',
            date: payment.entryDate,
            workspace_id: workspaceId,
            user_id: userId,
            // Named so a client can tell this went through the payments core
            // rather than landing in `transactions`.
            source: 'payment',
          })
        } catch (err) {
          if (err instanceof IdempotencyUnavailableError) {
            return reply.code(503).send({ error: err.message, code: err.code })
          }
          if (err instanceof BaseError && err.statusCode < 500) {
            const code = /^[A-Z][A-Z_]{6,}/.exec(err.message)?.[0]
            return reply.code(err.statusCode).send({ error: err.message, code: code ?? err.name })
          }
          fastify.log.error(err)
          return reply.code(500).send({ error: 'ثبت پرداخت ناموفق بود' })
        }
      }

      // A replayed offline create answers with the row it already wrote.
      if (clientRequestId) {
        const { data: existing, error: lookupError } = await supabase
          .from('transactions')
          .select()
          .eq('workspace_id', workspaceId)
          .eq('client_request_id', clientRequestId)
          .maybeSingle()
        if (lookupError && isMissingIdempotencySupport(lookupError)) {
          const unavailable = new IdempotencyUnavailableError('transaction')
          return reply.code(503).send({ error: unavailable.message, code: unavailable.code })
        }
        if (lookupError) {
          fastify.log.error(lookupError)
          return reply.code(500).send({ error: lookupError.message })
        }
        if (existing) return reply.code(200).header('idempotent-replay', 'true').send(existing)
      }

      const { data, error } = await supabase
        .from('transactions')
        .insert({
          ...(clientRequestId ? { client_request_id: clientRequestId } : {}),
          customer_id: body.customerId ?? null,
          supplier_id: body.supplierId ?? null,
          type: body.type,
          amount: body.amount,
          currency: body.currency ?? 'AFN',
          description: body.description ?? '',
          reference: body.reference ?? '',
          date: body.date ?? new Date().toISOString(),
          workspace_id: workspaceId,
          user_id: userId,
        })
        .select()
        .single()

      if (error && clientRequestId) {
        if (error.code === '23505') {
          const { data: winner } = await supabase
            .from('transactions')
            .select()
            .eq('workspace_id', workspaceId)
            .eq('client_request_id', clientRequestId)
            .maybeSingle()
          if (winner) return reply.code(200).header('idempotent-replay', 'true').send(winner)
        }
        if (isMissingIdempotencySupport(error)) {
          const unavailable = new IdempotencyUnavailableError('transaction')
          return reply.code(503).send({ error: unavailable.message, code: unavailable.code })
        }
      }
      if (error) {
        fastify.log.error(error)
        return reply.code(500).send({ error: error.message })
      }

      await clearCache(`transactions:${workspaceId}:*`)
      await clearCache(`dashboard:${workspaceId}`)
      await clearCache(`sales:${workspaceId}:*`)
      return reply.code(201).send(data)
    },
  )

  // GET /api/transactions/balance/:customerId
  fastify.get(
    '/api/transactions/balance/:customerId',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        cacheMiddleware({ scope: 'workspace', ttl: 60, keyPrefix: 'transaction-balance' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { customerId } = request.params as { customerId: string }

      // ⚠️ SECURITY — unscoped. Any customer id returned that party's full balance
      // AND their transaction rows, whichever business they belonged to.
      const { workspaceId } = request.tenancy

      const { data, error } = await supabase
        .from('transactions_view')
        .select('type, amount, currency')
        .eq('workspace_id', workspaceId)
        .eq('customer_id', customerId)

      if (error) return reply.code(500).send({ error: error.message })

      // ⚠️ SIGN — this route had 'receipt' on the PLUS side and 'payment' on
      // the minus side, which is both of them backwards. Money ARRIVING from a
      // customer was recorded as increasing their debt, and money we paid OUT
      // as reducing it. It is lesson 10 exactly, in a second place: the fix
      // landed in `customer.service.getBalance()` and this copy was missed.
      //
      // The arithmetic is no longer written here at all. `partyBalance` is the
      // one definition of what each movement means, it is unit-tested, and a
      // third copy of these four lines is how a third disagreement starts.
      const balance = partyBalance(
        (data ?? []).map((tx) => ({
          date: '',
          reference: '',
          amount: Number(tx.amount) || 0,
          kind:
            tx.type === 'sale'
              ? ('sale' as const)
              : tx.type === 'receipt'
                ? ('payment_in' as const)
                : tx.type === 'payment'
                  ? ('payment_out' as const)
                  : tx.type === 'purchase'
                    ? ('purchase' as const)
                    : ('return' as const),
        })),
      )

      return {
        customerId,
        balance,
        isDebtor: balance > 0,
        transactions: data ?? [],
      }
    },
  )

  // DELETE /api/transactions/:id
  fastify.delete(
    '/api/transactions/:id',
    {
      preHandler: [authenticate, requireWorkspaceContext],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }

      // ⚠️ SECURITY — unscoped DELETE. Any authenticated user could destroy any
      // transaction on the platform by guessing or harvesting its id.
      const { workspaceId } = request.tenancy

      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id)
        .eq('workspace_id', workspaceId)

      if (error) return reply.code(500).send({ error: error.message })

      await clearCache(`transactions:${workspaceId}:*`)
      await clearCache(`dashboard:${workspaceId}`)
      await clearCache(`sales:${workspaceId}:*`)
      return reply.code(204).send()
    },
  )
}
