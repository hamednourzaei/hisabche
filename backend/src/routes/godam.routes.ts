import { FastifyInstance } from 'fastify'

export async function godamRoutes(fastify: FastifyInstance) {
  fastify.get('/api/godams', async () => {
    return { godams: [{ id: 'default', name: 'گدام اصلی' }] }
  })

  fastify.post('/api/stock-transfers', async (request) => {
    const body = request.body as any
    return { id: `transfer-${Date.now()}`, ...body, date: new Date().toISOString() }
  })
}