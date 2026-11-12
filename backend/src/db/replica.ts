import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { primaryDb } from './primary'

const replicaUrl = process.env.SUPABASE_REPLICA_URL
const serviceKey = process.env.SUPABASE_SERVICE_KEY

let replicaClient: SupabaseClient | null = null
if (replicaUrl && serviceKey) {
  replicaClient = createClient(replicaUrl, serviceKey, {
    auth: { persistSession: false },
  })
}

export function getReplicaClientOrPrimary(): {
  client: SupabaseClient
  isReplica: boolean
} {
  if (replicaClient) {
    return { client: replicaClient, isReplica: true }
  }
  return { client: primaryDb, isReplica: false }
}

export const replicaDb = replicaClient ?? primaryDb
