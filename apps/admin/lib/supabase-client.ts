// ============================================
// apps/admin/lib/supabase-client.ts
// Browser-side Supabase client (reuses existing project infra).
// ============================================

import { createBrowserClient } from '@supabase/ssr'

export function createAdminSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
