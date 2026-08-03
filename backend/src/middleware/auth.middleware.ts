// ============================================
// backend/src/middleware/auth.middleware.ts
// FIXED: کش کردن نتیجه auth برای حذف کوئری تکراری
// روی هر درخواست (که سریالی و بدون ایندکس بود)
// FIXED (v2): memoryCache.get/set در pagination.ts به‌صورت async
// (Redis-backed) هستند — قبلاً بدون await صدا زده می‌شدند که باعث
// می‌شد `cached` همیشه یک Promise باشد، نه مقدار resolve‌شده (خطای
// build: Property 'user' does not exist on type 'Promise<...>').
// FIXED (v2): واحد TTL اصلاح شد — memoryCache.set (از طریق
// cacheService.set) مقدار TTL را به‌عنوان ثانیه به Redis (EX) پاس
// می‌دهد، نه میلی‌ثانیه. مقدار قبلی (30_000) عملاً باعث می‌شد کش
// auth حدود ۸.۳ ساعت (نه ۳۰ ثانیه) زنده بماند.
// ============================================

import { FastifyRequest, FastifyReply } from 'fastify'
import { supabase } from '../db'
import { memoryCache } from '../utils/pagination'

// ✅ Declaration merging برای تایپ‌دهی صحیح
declare module 'fastify' {
  interface FastifyRequest {
    user: any
    userId: string
    workspaceId: string
    userRole: string
  }
}

interface CachedAuth {
  user: any
  workspaceId: string
  role: string
}

// ✅ TTL کش auth بر حسب ثانیه — کوتاه نگه داشته شده برای تعادل بین
// سرعت و امنیت (اگه نیاز به revoke فوری‌تر توکن/نقش داری، این عدد
// رو کمتر کن). واحد: ثانیه، چون memoryCache.set → cacheService.set
// از Redis EX (ثانیه) استفاده می‌کند.
const AUTH_CACHE_TTL_SECONDS = 30

// حداکثر مدتی که نتیجه‌ی یک توکن تأییدشده کش می‌ماند (ثانیه). حتی اگر توکن
// عمر بلندتری داشته باشد، از این بیشتر کش نمی‌شود تا پنجره‌ی revoke منطقی
// بماند.
const AUTH_CACHE_MAX_TTL_SECONDS = 3600

// فاصله‌ی امن قبل از انقضای توکن؛ تا درخواستی با توکنِ تازه‌منقضی‌شده از کش
// سرو نشود.
const AUTH_CACHE_EXPIRY_SKEW_SECONDS = 60

/**
 * زمان انقضای (exp) توکن را از payload خودش می‌خواند.
 *
 * ⚠️ این تابع امضا را تأیید نمی‌کند و نباید هرگز به‌عنوان مبنای اعتماد
 * استفاده شود — فقط زمانی صدا زده می‌شود که توکن قبلاً توسط
 * supabase.auth.getUser() تأیید شده باشد، و صرفاً برای تعیین طول عمر کش
 * به‌کار می‌رود.
 */
function getTokenExpirySeconds(token: string): number | null {
  const parts = token.split('.')
  if (parts.length !== 3 || !parts[1]) return null
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
    return typeof payload?.exp === 'number' ? payload.exp : null
  } catch {
    return null
  }
}

/**
 * کش را تا کمی قبل از انقضای توکن نگه می‌دارد.
 *
 * ✅ FIX: قبلاً هر توکن فقط ۳۰ ثانیه کش می‌شد، یعنی هنگام گشتن در برنامه
 * تقریباً هر ۳۰ ثانیه یک بار supabase.auth.getUser() صدا زده می‌شد و
 * مصرف Auth بی‌دلیل بالا می‌رفت. حالا هر توکن فقط **یک بار** تأیید می‌شود
 * و نتیجه تا انقضای همان توکن معتبر می‌ماند؛ یعنی عملاً یک درخواست auth
 * به‌ازای هر ورود/رفرش توکن، نه به‌ازای هر ۳۰ ثانیه گشتن در صفحات.
 */
function resolveAuthCacheTtl(token: string): number {
  const exp = getTokenExpirySeconds(token)
  if (!exp) return AUTH_CACHE_TTL_SECONDS

  const remaining = exp - Math.floor(Date.now() / 1000) - AUTH_CACHE_EXPIRY_SKEW_SECONDS
  if (remaining <= 0) return AUTH_CACHE_TTL_SECONDS

  return Math.min(remaining, AUTH_CACHE_MAX_TTL_SECONDS)
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization
  if (!authHeader) {
    return reply.status(401).send({ error: 'Missing authorization header' })
  }

  const token = authHeader.replace('Bearer ', '')

  // ✅ FIX: چک کش قبل از هر کوئری — await اضافه شد چون memoryCache.get
  // یک Promise برمی‌گرداند (wrapper روی cacheService.get که Redis-backed است)
  const cacheKey = `auth:${token}`
  const cached = await memoryCache.get<CachedAuth>(cacheKey)

  if (cached) {
    request.user = cached.user
    request.userId = cached.user.id
    request.workspaceId = cached.workspaceId
    request.userRole = cached.role
    return
  }

  // ✅ کوئری ۱: verify توکن
  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    return reply.status(401).send({ error: 'Invalid or expired token' })
  }

  // ✅ کوئری ۲: گرفتن workspace/role
  // نکته: این کوئری با ایندکس idx_workspace_members_user_id سریع میشه
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  const result: CachedAuth = {
    user,
    workspaceId: membership?.workspace_id || '',
    role: membership?.role || 'admin',
  }

  // ✅ FIX: ذخیره در کش برای درخواست‌های بعدی همین کاربر — await اضافه شد
  await memoryCache.set(cacheKey, result, resolveAuthCacheTtl(token))

  request.user = user
  request.userId = user.id
  request.workspaceId = result.workspaceId
  request.userRole = result.role
}

export const authPreHandler = authenticate