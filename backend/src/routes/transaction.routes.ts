import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { supabase } from '../db'

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

  // ── GET /api/transactions ──────────────────────────────
  fastify.get('/api/transactions', async (request: FastifyRequest, reply: FastifyReply) => {
    const q          = request.query as Record<string, string>
    const customerId = q.customerId ?? ''
    const supplierId = q.supplierId ?? ''
    const type       = q.type ?? ''
    const page       = Math.max(1, parseInt(q.page  ?? '1'))
    const limit      = Math.min(100, parseInt(q.limit ?? '20'))
    const from       = (page - 1) * limit
    const to         = from + limit - 1

    let query = supabase
      .from('transactions')
      .select('*', { count: 'exact' })
      .order('date', { ascending: false })
      .range(from, to)

    if (customerId) query = query.eq('customer_id', customerId)
    if (supplierId) query = query.eq('supplier_id', supplierId)
    if (type)       query = query.eq('type', type)

    const { data, error, count } = await query

    if (error) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message })
    }

    return { transactions: data ?? [], total: count ?? 0, page, limit }
  })

  // ── POST /api/transactions ─────────────────────────────
  fastify.post('/api/transactions', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as CreateTransactionBody

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
        type:        body.type,
        amount:      body.amount,
        currency:    body.currency    ?? 'AFN',
        description: body.description ?? '',
        reference:   body.reference   ?? '',
        date:        body.date        ?? new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message })
    }

    return reply.code(201).send(data)
  })

  // ── GET /api/transactions/balance/:customerId ──────────
  // باقی‌داری مشتری
  fastify.get('/api/transactions/balance/:customerId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { customerId } = request.params as { customerId: string }

    const { data, error } = await supabase
      .from('transactions')
      .select('type, amount, currency')
      .eq('customer_id', customerId)

    if (error) return reply.code(500).send({ error: error.message })

    // محاسبه باقی‌داری
    const balance = (data ?? []).reduce((acc, tx) => {
      const amount = Number(tx.amount)
      if (tx.type === 'sale')     return acc + amount   // بدهکار شد
      if (tx.type === 'payment')  return acc - amount   // پرداخت کرد
      if (tx.type === 'return')   return acc - amount   // برگشت داد
      if (tx.type === 'receipt')  return acc + amount
      return acc
    }, 0)

    return {
      customerId,
      balance,
      isDebtor: balance > 0,
      transactions: data ?? [],
    }
  })

  // ── DELETE /api/transactions/:id ───────────────────────
  fastify.delete('/api/transactions/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)

    if (error) return reply.code(500).send({ error: error.message })
    return reply.code(204).send()
  })
}