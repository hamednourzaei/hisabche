import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://quxpxatopmquheoazzlj.supabase.co'
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'sb_publishable_mGppZjb0DVEKLFf7f1XjmQ_iHBQVu_U'

// ============================================
// ✅ Singleton واقعی — فقط یک بار در کل اپلیکیشن ساخته می‌شود
// از globalThis استفاده می‌کنیم تا در حالت dev، وقتی Next.js با
// Fast Refresh این ماژول را دوباره اجرا می‌کند، کلاینت قبلی از بین نرود
// و دوباره ساخته نشود (علت اصلی هشدار Multiple GoTrueClient در dev).
// ============================================

declare global {
  // eslint-disable-next-line no-var
  var __hisabche_supabase_client__: SupabaseClient | undefined
}

function createSupabaseClient(): SupabaseClient {
  return createClient(supabaseUrl, supabaseKey, {
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  })
}

export const supabaseClient: SupabaseClient =
  globalThis.__hisabche_supabase_client__ ?? createSupabaseClient()

if (process.env.NODE_ENV !== 'production') {
  globalThis.__hisabche_supabase_client__ = supabaseClient
}