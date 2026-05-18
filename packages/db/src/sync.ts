import { synchronize } from '@nozbe/watermelondb/sync'
import { supabaseClient } from './supabase'

export async function syncDatabase(database: any) {
  await synchronize({
    database,
    pullChanges: async ({ lastPulledAt }) => {
      const tables = ['invoices', 'products', 'customers', 'transactions']
      const changes: any = {}

      for (const table of tables) {
        let q = supabaseClient.from(table).select('*')
        if (lastPulledAt) q = q.gt('updated_at', new Date(lastPulledAt).toISOString())
        const { data } = await q
        if (data) {
          changes[table] = { created: data.map((row: any) => ({ ...row, _changed: '' })), updated: [], deleted: [] }
        }
      }

      return { changes, timestamp: Date.now() }
    },
    pushChanges: async ({ changes }: any) => {
      for (const table of Object.keys(changes)) {
        const tableChanges = changes[table]
        if (tableChanges.created?.length) {
          for (const record of tableChanges.created) {
            const { id, _status, _changed, ...fields } = record
            await supabaseClient.from(table).upsert(fields).select()
          }
        }
        if (tableChanges.updated?.length) {
          for (const record of tableChanges.updated) {
            const { id, _status, _changed, ...fields } = record
            await supabaseClient.from(table).update(fields).eq('id', id)
          }
        }
        if (tableChanges.deleted?.length) {
          const ids = tableChanges.deleted.map((r: any) => r.id)
          await supabaseClient.from(table).delete().in('id', ids)
        }
      }
    },
    sendCreatedAsUpdated: true,
  })
}