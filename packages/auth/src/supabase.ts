import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// The Electron renderer is bundled by Vite, which does not define `process`,
// so reading it directly makes this module throw on import there.
const env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || 'https://quxpxatopmquheoazzlj.supabase.co'
const supabaseKey =
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_mGppZjb0DVEKLFf7f1XjmQ_iHBQVu_U'

// ============================================
// ✅ Singleton واقعی — فقط یک بار در کل اپلیکیشن ساخته می‌شود
// از globalThis استفاده می‌کنیم تا در حالت dev، وقتی Next.js با
// Fast Refresh این ماژول را دوباره اجرا می‌کند، کلاینت قبلی از بین نرود
// و دوباره ساخته نشود (علت اصلی هشدار Multiple GoTrueClient در dev).
// ============================================

declare global {
  var __hisabche_supabase_client__: SupabaseClient | undefined
}

// ============================================
// ⚠️ REALTIME RAN AS `anon`, SO RLS SENT IT NOTHING.
//
// Sign-in goes through the backend, never through this client, so this
// client never had a session: every realtime channel joined with the anon
// key. Realtime delivers a row only if the subscriber's RLS SELECT policy
// allows it, and anon is allowed nothing — so another employee's invoice
// never reached anyone's open dashboard. Only the person who made a change
// saw it (the mutation cache refreshes their own tab).
//
// `accessToken` is supabase-js's supported way to use a token issued
// elsewhere, and it is ASKED AGAIN on every realtime heartbeat — so a token
// refreshed by the backend reaches the socket without anyone re-subscribing.
// A one-off `realtime.setAuth(token)` would not survive: supabase-js resets
// it from its own (empty) session on the next heartbeat.
//
// The source is registered by `@hisabche/api` — this package sits below it
// and must not import it back.
// ============================================
type TokenSource = () => string | null

let tokenSource: TokenSource | null = null

export function setSupabaseTokenSource(source: TokenSource): void {
  tokenSource = source
}

function createSupabaseClient(): SupabaseClient {
  return createClient(supabaseUrl, supabaseKey, {
    accessToken: async () => tokenSource?.() ?? null,
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  })
}

export const supabaseClient: SupabaseClient =
  globalThis.__hisabche_supabase_client__ ?? createSupabaseClient()

if (env.NODE_ENV !== 'production') {
  globalThis.__hisabche_supabase_client__ = supabaseClient
}
