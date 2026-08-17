// ============================================
// backend/src/db.ts — Optimized v2.2
// FIXED: حذف کامل hardcoded fallback برای SUPABASE_URL و
// SUPABASE_SERVICE_KEY. قبلاً اگر متغیر محیطی ست نمی‌شد، یک
// URL و Service Role Key واقعی (با دسترسی کامل و بدون RLS)
// به‌صورت hardcode در کد استفاده می‌شد — یعنی هر کپی از این
// فایل (حتی در یک چت یا ریپوی دیگر) کلید واقعی production را
// افشا می‌کرد. حالا نبود این دو متغیر باعث خطای صریح در
// startup می‌شود، نه استفاده‌ی خاموش از یک کلید قدیمی/نادرست.
// ============================================

import { createClient, SupabaseClientOptions } from '@supabase/supabase-js'

const isLocal = !process.env.RENDER

// ✅ FIX: بدون fallback — نبود این دو متغیر باید در استارت‌آپ
// به‌صورت صریح fail شود، نه با یک کلید hardcode جایگزین شود.
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL) {
  throw new Error('❌ SUPABASE_URL environment variable is required and was not set.')
}

if (!SUPABASE_SERVICE_KEY) {
  throw new Error('❌ SUPABASE_SERVICE_KEY environment variable is required and was not set.')
}

// ✅ تشخیصی امن: فقط claim داخل JWT رو می‌خونه (بدون verify، بدون
// افشای خود کلید) تا مشخص بشه واقعاً service_role وصل شده یا anon.
// این باگ چند خطای امروز (RLS بلاک‌کردن insert/select با وجود سطر
// صحیح در دیتابیس) را توضیح می‌دهد اگر اینجا anon چاپ شود.
try {
  const payloadBase64 = SUPABASE_SERVICE_KEY.split('.')[1] || ''
  const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf8'))
  console.log(`🔑 [SUPABASE_SERVICE_KEY] role claim = "${payload.role}" (باید "service_role" باشد)`)
  if (payload.role !== 'service_role') {
    console.error(
      `❌ [SUPABASE_SERVICE_KEY] این کلید anon/publishable است نه service_role — RLS برای همه‌ی کوئری‌های بک‌اند فعال می‌ماند.`,
    )
  }
} catch (e) {
  console.error(
    '⚠️ [SUPABASE_SERVICE_KEY] نتوانستم JWT را decode کنم — احتمالاً مقدار کلید معتبر نیست.',
    e,
  )
}

// Captured after the guards above so the narrowing survives into functions
// declared later — inside a function body TypeScript cannot rely on a
// module-scope throw having already run.
const SUPABASE_URL_CHECKED: string = SUPABASE_URL
const SUPABASE_SERVICE_KEY_CHECKED: string = SUPABASE_SERVICE_KEY

const clientOptions: SupabaseClientOptions<'public'> = {
  auth: { persistSession: false },
  db: {
    schema: 'public',
  },
  global: {
    headers: {
      'x-hisabche-version': '2.2',
    },
  },
}

if (isLocal) {
  try {
    const { ProxyAgent, fetch: undiciFetch } = require('undici')
    const proxyAgent = new ProxyAgent('http://127.0.0.1:10808')
    clientOptions.global = {
      ...clientOptions.global,
      fetch: (input: any, init?: any) => undiciFetch(input, { ...init, dispatcher: proxyAgent }),
    }
  } catch {
    console.log('ℹ️ undici not installed, skipping proxy setup')
  }
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, clientOptions)

/**
 * A throwaway client for operations that establish a user session.
 *
 * ⚠️ Never call `signInWithPassword` / `setSession` on the shared `supabase`
 * client above. Doing so attaches that user's access token to the client
 * IN MEMORY and every later query is sent as `Authorization: Bearer
 * <user-token>` — so the process silently stops being `service_role` and
 * becomes whoever logged in most recently. `persistSession: false` does not
 * prevent this; it only stops the session being written to storage.
 *
 * That was the cause of `42501 new row violates row-level security policy for
 * table "workspace_members"`: reads still passed (the owner's own row matches
 * the SELECT policy, which is why `requireRole` succeeded) while the INSERT
 * had no policy for `authenticated` and was refused. The startup log still
 * reported `service_role` because it is checked before anyone has logged in.
 *
 * Each call gets a fresh client so sessions cannot leak between requests.
 */
export function createAuthClient() {
  return createClient(SUPABASE_URL_CHECKED, SUPABASE_SERVICE_KEY_CHECKED, {
    ...clientOptions,
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const { data, error } = await supabase.from('products').select('id').limit(1)
    return !error
  } catch {
    return false
  }
}

// ✅ Connection Monitoring
let connectionCount = 0
let totalQueries = 0
let slowQueries = 0

export const dbStats = {
  getConnectionCount: () => connectionCount,
  getTotalQueries: () => totalQueries,
  getSlowQueries: () => slowQueries,
  incrementConnection: () => connectionCount++,
  decrementConnection: () => connectionCount--,
  incrementQueries: () => totalQueries++,
  incrementSlowQueries: () => slowQueries++,
  reset: () => {
    connectionCount = 0
    totalQueries = 0
    slowQueries = 0
  },
}

export const withConnection = async <T>(fn: () => Promise<T>, queryName?: string): Promise<T> => {
  const startTime = Date.now()
  dbStats.incrementConnection()
  dbStats.incrementQueries()

  try {
    const result = await fn()
    const duration = Date.now() - startTime

    if (duration > 500) {
      dbStats.incrementSlowQueries()
      console.warn(`⚠️ Slow query: ${queryName || 'unnamed'} - ${duration}ms`)
    }

    return result
  } finally {
    dbStats.decrementConnection()
  }
}

export default supabase
