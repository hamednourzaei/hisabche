import { FastifyInstance, FastifyRequest } from 'fastify'
import { supabase } from '../db'

export async function productRoutes(fastify: FastifyInstance) {

  // ── GET /api/products ──────────────────────────────────
  fastify.get('/api/products', async (request: FastifyRequest, reply) => {
    const query  = request.query as Record<string, string>
    const search = query.search ?? ''
    const page   = Math.max(1, parseInt(query.page  ?? '1'))
    const limit  = Math.min(100, parseInt(query.limit ?? '20'))
    const from   = (page - 1) * limit
    const to     = from + limit - 1

    let q = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (search) {
      q = q.ilike('name', `%${search}%`)
    }

    const { data, error, count } = await q

    if (error) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message })
    }

    return { products: data, total: count, page, limit }
  })

  // ── POST /api/products ─────────────────────────────────
  fastify.post('/api/products', async (request: FastifyRequest, reply) => {
    const body = request.body as Record<string, unknown>

    const { data, error } = await supabase
      .from('products')
      .insert({
        name:           String(body.name           ?? 'بدون نام'),
        barcode:        String(body.barcode         ?? ''),
        sku:            String(body.sku             ?? ''),
        category:       String(body.category        ?? 'general'),
        quantity:       Number(body.quantity         ?? 0),
        unit:           String(body.unit            ?? 'piece'),
        buy_price:      String(body.buyPrice         ?? '0'),
        sell_price:     String(body.sellPrice        ?? '0'),
        wholesale_price:String(body.wholesalePrice   ?? '0'),
        min_stock_level:Number(body.minStockLevel    ?? 5),
        description:    String(body.description     ?? ''),
        is_active:      body.isActive !== false,
      })
      .select()
      .single()

    if (error) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message })
    }

    return reply.code(201).send(data)
  })

  // ── GET /api/products/:id ──────────────────────────────
  fastify.get('/api/products/:id', async (request: FastifyRequest, reply) => {
    const { id } = request.params as { id: string }

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single()

    if (error) return reply.code(404).send({ error: 'Not found' })
    return data
  })

  // ── PUT /api/products/:id ──────────────────────────────
  fastify.put('/api/products/:id', async (request: FastifyRequest, reply) => {
    const { id } = request.params as { id: string }
    const body   = request.body as Record<string, unknown>

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.name          != null) updates.name           = String(body.name)
    if (body.category      != null) updates.category       = String(body.category)
    if (body.quantity      != null) updates.quantity       = Number(body.quantity)
    if (body.unit          != null) updates.unit           = String(body.unit)
    if (body.buyPrice      != null) updates.buy_price      = String(body.buyPrice)
    if (body.sellPrice     != null) updates.sell_price     = String(body.sellPrice)
    if (body.minStockLevel != null) updates.min_stock_level= Number(body.minStockLevel)
    if (body.isActive      != null) updates.is_active      = Boolean(body.isActive)

    const { data, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) return reply.code(500).send({ error: error.message })
    return data
  })

  // ── DELETE /api/products/:id ───────────────────────────
  fastify.delete('/api/products/:id', async (request: FastifyRequest, reply) => {
    const { id } = request.params as { id: string }

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)

    if (error) return reply.code(500).send({ error: error.message })
    return reply.code(204).send()
  })
}