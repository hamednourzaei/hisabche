// ═══ Supabase Realtime — فقط وقتی URL موجود باشه ═══

let supabase: any = null

export function getSupabase() {
  if (typeof window === 'undefined') return null
  if (supabase) return supabase

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) return null

  import('@supabase/supabase-js').then(({ createClient }) => {
    supabase = createClient(url, key, {
      realtime: { params: { eventsPerSecond: 10 } },
    })
  })

  return null
}

export function subscribeToChannel(
  table: string,
  callback: () => void,
) {
  const client = getSupabase()
  if (!client) return { unsubscribe: () => {} }

  return client
    .channel(`hisabche-${table}`)
    .on(
      'postgres_changes' as any,
      { event: '*', schema: 'public', table },
      () => callback(),
    )
    .subscribe()
}