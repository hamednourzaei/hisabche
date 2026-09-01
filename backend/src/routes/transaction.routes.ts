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

        const { data, error } = await supabase
          .from('transactions')
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

      let query = supabase
        .from('transactions')
        .select('*', { count: 'exact' })
        .eq('workspace_id', workspaceId)
        .order('date', { ascending: false })
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

      if (!body.amount || body.amount <= 0) {
        return reply.code(400).send({ error: 'مبلغ معتبر نیست' })
      }

      if (!body.customerId && !body.supplierId) {
        return reply.code(400).send({ error: 'مشتری یا تأمین‌کننده الزامی است' })
      }

      const { data, error } = await supabase
        .from('transactions')
        .insert({
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
        .from('transactions')
        .select('type, amount, currency')
        .eq('workspace_id', workspaceId)
        .eq('customer_id', customerId)

      if (error) return reply.code(500).send({ error: error.message })

      const balance = (data ?? []).reduce((acc, tx) => {
        const amount = Number(tx.amount)
        if (tx.type === 'sale') return acc + amount
        if (tx.type === 'payment') return acc - amount
        if (tx.type === 'return') return acc - amount
        if (tx.type === 'receipt') return acc + amount
        return acc
      }, 0)

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
