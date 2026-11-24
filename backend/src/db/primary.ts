import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../db'

export const primaryDb = supabase
export { supabase }

/**
 * Registry of live write-capable database clients keyed by logical `writerId`.
 * During normal operation the default writer resolves to `primaryDb`.
 * After an approved standby promotion (`promoteStandby`), registering the promoted
 * standby client lets `selectWriteClient()` switch real write traffic away from
 * the fenced primary without waiting for a process restart.
 */
const writerClients = new Map<string, SupabaseClient>()

export function registerWriterClient(writerId: string, client: SupabaseClient): void {
  writerClients.set(writerId, client)
}

export function getRegisteredWriterClient(writerId: string): SupabaseClient | undefined {
  return writerClients.get(writerId)
}

export function clearRegisteredWriterClients(): void {
  writerClients.clear()
}
