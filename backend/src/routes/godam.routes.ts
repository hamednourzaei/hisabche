import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { supabase } from '../db'

export async function godamRoutes(fastify: FastifyInstance) {
  
  // GET /api/godams
  fastify.get('/api/godams', async () => {
    return { godams: [{ id: 'default', name: 'گدام اصلی' }] }
  })

  // POST /api/stock-transfers
  fastify.post('/api/stock-transfers', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any
    const userId = (request as any).userId

    const { data, error } = await supabase
      .from('stock_movements')
      .insert({
        product_id:     body.productId,
        type:           body.type || 'adjustment',
        quantity:       body.quantity,
        reference_type: 'transfer',
        reference_id:   null,
        notes:          body.notes || '',
        user_id:        userId,
      })
      .select()
      .single()

    if (error) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message })
    }

    return { id: `transfer-${Date.now()}`, ...body, date: new Date().toISOString(), record: data }
  })
}