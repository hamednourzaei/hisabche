import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null

export function subscribeToChannel(
  table: string,
  callback: () => void,
) {
  if (!supabase) return { unsubscribe: () => {} }
  
  return supabase
    .channel(`hisabche-${table}`)
    .on(
      'postgres_changes' as any,
      { event: '*', schema: 'public', table },
      () => callback(),
    )
    .subscribe()
}