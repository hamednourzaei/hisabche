// ============================================
// packages/api/src/supabase/realtime.ts
// ============================================

import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'

import { supabaseClient } from '../../../auth/src/supabase'

// ✅ دیگر کلاینت جدا نمی‌سازیم — از همان singleton مشترک استفاده می‌کنیم
// این همان چیزی بود که باعث «Multiple GoTrueClient instances» می‌شد:
// این فایل قبلاً یک createClient() مستقل خودش داشت.

export async function subscribeToChannel(
  table: string,
  callback: () => void,
): Promise<{ unsubscribe: () => void }> {
  if (typeof window === 'undefined') {
    return { unsubscribe: () => {} }
  }

  const channel: RealtimeChannel = supabaseClient
    .channel(`hisabche-${table}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      () => callback(),
    )
    .subscribe()

  return {
    unsubscribe: () => {
      supabaseClient.removeChannel(channel)
    },
  }
}