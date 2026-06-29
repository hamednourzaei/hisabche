// ============================================
// packages/api/src/supabase/realtime.ts
// ============================================

import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'

let supabase: SupabaseClient | null = null
let initPromise: Promise<SupabaseClient | null> | null = null

async function getSupabase(): Promise<SupabaseClient | null> {
  if (typeof window === 'undefined') return null
  if (supabase) return supabase

  // جلوگیری از ساخته شدن چند promise موازی
  if (initPromise) return initPromise

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null

  initPromise = Promise.resolve(
    createClient(url, key, {
      realtime: { params: { eventsPerSecond: 10 } },
    })
  )

  supabase = await initPromise
  return supabase
}

export async function subscribeToChannel(
  table: string,
  callback: () => void,
): Promise<{ unsubscribe: () => void }> {
  const client = await getSupabase()
  if (!client) return { unsubscribe: () => {} }

  const channel: RealtimeChannel = client
    .channel(`hisabche-${table}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      () => callback(),
    )
    .subscribe()

  return {
    unsubscribe: () => client.removeChannel(channel),
  }
}