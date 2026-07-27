// ============================================
// packages/api/src/supabase/realtime.ts
// ============================================

import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'

import { supabaseClient } from '../../../auth/src/supabase'

// ✅ دیگر کلاینت جدا نمی‌سازیم — از همان singleton مشترک استفاده می‌کنیم
// این همان چیزی بود که باعث «Multiple GoTrueClient instances» می‌شد:
// این فایل قبلاً یک createClient() مستقل خودش داشت.

// ✅ FIX: نام کانال قبلاً فقط از نام جدول ساخته می‌شد (`hisabche-${table}`)
// — یعنی وقتی دو هوک مختلف (مثلاً useNotifications و useUnreadCount در
// notification-bell.tsx) همزمان روی یک جدول subscribe می‌کردند، هر دو
// سعی می‌کردند دقیقاً همان نام کانال را بسازند و با هم تداخل می‌کردند
// (یکی از دو subscription پیام postgres_changes را از دست می‌داد).
// حالا هر فراخوانی subscribeToChannel یک کانال کاملاً مجزا و یکتا
// می‌گیرد، صرف‌نظر از این‌که چند مصرف‌کننده‌ی دیگر روی همان جدول
// subscribe کرده‌اند.
let channelCounter = 0

export async function subscribeToChannel(
  table: string,
  callback: () => void,
): Promise<{ unsubscribe: () => void }> {
  if (typeof window === 'undefined') {
    return { unsubscribe: () => {} }
  }

  channelCounter += 1
  const channel: RealtimeChannel = supabaseClient
    .channel(`hisabche-${table}-${channelCounter}`)
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