// ============================================
// backend/src/routes/sync.routes.ts
// ============================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { supabase } from '../db'
import { authenticate } from '../middleware/auth.middleware'
import { cacheMiddleware, clearCache } from '../middleware/cache.middleware'

interface SyncPullBody {
  lastPulledAt: number
}

interface SyncPushBody {
  changes: any
  lastPulledAt: number
}

export async function syncRoutes(fastify: FastifyInstance) {
  
  // GET /api/sync/pull
  fastify.get('/api/sync/pull', {
    preHandler: [authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { last_pulled_at } = request.query as { last_pulled_at?: string }
    const userId = (request as any).userId
    const timestamp = Date.now()

    const changes = {
      invoices: { created: [], updated: [], deleted: [] },
      products: { created: [], updated: [], deleted: [] },
      customers: { created: [], updated: [], deleted: [] },
      transactions: { created: [], updated: [], deleted: [] },
    }

    // Pull only user's own data (RLS handles this automatically)
    try {
      const tables = ['invoices', 'products', 'customers', 'transactions'] as const
      
      for (const table of tables) {
        const { data: created } = await supabase
          .from(table)
          .select('*')
          .eq('user_id', userId)
          .gt('created_at', new Date(last_pulled_at || 0).toISOString())
          .order('created_at', { ascending: true })

        const { data: updated } = await supabase
          .from(table)
          .select('*')
          .eq('user_id', userId)
          .gt('updated_at', new Date(last_pulled_at || 0).toISOString())
          .lt('created_at', new Date(last_pulled_at || 0).toISOString())
          .order('updated_at', { ascending: true })

        if (created) (changes as any)[table].created = created
        if (updated) (changes as any)[table].updated = updated
      }
    } catch (err) {
      fastify.log.error(err)
    }

    return { changes, timestamp }
  })

  // POST /api/sync/push
  fastify.post('/api/sync/push', {
    preHandler: [authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { changes, lastPulledAt } = request.body as SyncPushBody
    const userId = (request as any).userId

    if (changes) {
      for (const [table, tableChanges] of Object.entries(changes) as [string, any][]) {
        // Insert created
        if (tableChanges.created?.length) {
          const withUser = tableChanges.created.map((row: any) => ({ ...row, user_id: userId }))
          const { error } = await supabase.from(table).insert(withUser)
          if (error) fastify.log.error(error, `Sync insert ${table}`)
        }

        // Update modified
        if (tableChanges.updated?.length) {
          for (const row of tableChanges.updated) {
            const { id, ...updates } = row
            const { error } = await supabase.from(table).update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId)
            if (error) fastify.log.error(error, `Sync update ${table}`)
          }
        }

        // Delete removed
        if (tableChanges.deleted?.length) {
          const ids = tableChanges.deleted.map((row: any) => row.id).filter(Boolean)
          if (ids.length) {
            const { error } = await supabase.from(table).delete().in('id', ids).eq('user_id', userId)
            if (error) fastify.log.error(error, `Sync delete ${table}`)
          }
        }
      }
      
      // Clear all caches after successful sync
      await clearCache('*')
    }

    return { success: true }
  })
}