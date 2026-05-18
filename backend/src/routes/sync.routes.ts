
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

interface SyncPullBody {
  lastPulledAt: number
}

interface SyncPushBody {
  changes: any
  lastPulledAt: number
}

export async function syncRoutes(fastify: FastifyInstance) {
  fastify.get('/api/sync/pull', async (request: FastifyRequest, reply: FastifyReply) => {
    const { last_pulled_at } = request.query as { last_pulled_at?: string }
    const timestamp = Date.now()

    const changes = {
      invoices: { created: [], updated: [], deleted: [] },
      products: { created: [], updated: [], deleted: [] },
      customers: { created: [], updated: [], deleted: [] },
      transactions: { created: [], updated: [], deleted: [] },
    }

    return { changes, timestamp }
  })

  fastify.post('/api/sync/push', async (request: FastifyRequest, reply: FastifyReply) => {
    const { changes, lastPulledAt } = request.body as SyncPushBody

    if (changes) {
      Object.entries(changes).forEach(([table, tableChanges]: [string, any]) => {
        if (tableChanges.created?.length) {
          fastify.log.info(`Sync: ${tableChanges.created.length} created in ${table}`)
        }
        if (tableChanges.updated?.length) {
          fastify.log.info(`Sync: ${tableChanges.updated.length} updated in ${table}`)
        }
        if (tableChanges.deleted?.length) {
          fastify.log.info(`Sync: ${tableChanges.deleted.length} deleted in ${table}`)
        }
      })
    }

    return { success: true }
  })
}