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
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { supabase } from '../db'
import { memoryCache } from '../utils/pagination'

/**
 * The authenticated user IS Supabase's `User` — this middleware puts the
 * result of `supabase.auth.getUser()` on the request unchanged.
 *
 * An earlier hand-rolled shape declared `email: string` (required) plus an
 * index signature, and neither matched: Supabase's email is optional (a
 * phone-only signup has none) and its User has no index signature, so the real
 * value could not be assigned to the type meant to describe it.
 *
 * Downstream reads only `.id` and `.email`; platformAdminGuard handles a
 * missing email at runtime, which is where it actually has to be handled.
 */
type AuthenticatedUser = SupabaseUser

// ✅ Declaration merging برای تایپ‌دهی صحیح
declare module 'fastify' {
  interface FastifyRequest {
    user: AuthenticatedUser
    userId: string
    userRole: string
    // NOTE: there is deliberately no ambient `workspaceId` here. It used to
    // exist and had to be `''` when the user had none or had several, which is
    // a fail-open tenancy value. The authorized workspace lives on
    // `request.tenancy`, set only by requireWorkspaceContext — see
    // middleware/workspace.middleware.ts.
  }
}

interface CachedAuth {
  user: AuthenticatedUser
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
    request.userRole = cached.role
    return
  }

  // ✅ کوئری ۱: verify توکن
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token)

  if (error || !user) {
    return reply.status(401).send({ error: 'Invalid or expired token' })
  }

  // ✅ کوئری ۲: گرفتن workspace/role
  //
  // ⚠️ SECURITY — this used to read:
  //
  //     .select('workspace_id, role').eq('user_id', user.id).limit(1).single()
  //     workspaceId: membership?.workspace_id || '',
  //     role:        membership?.role || 'admin',
  //
  // Three defects, all of which fail OPEN:
  //
  //   1. `|| 'admin'` gave a user with NO membership the 'admin' role. That is
  //      not inert: workflow.service.ts:452 accepts `userRole === 'admin'` as
  //      an approver override, so having no workspace granted approval rights.
  //   2. `.limit(1)` with no ORDER BY let PostgreSQL pick any membership, so a
  //      multi-workspace user could resolve to a different book per request.
  //   3. `has_access` and `suspended_at` were ignored — a suspended member
  //      still resolved to a workspace.
  //
  // Now: real role or none, deterministic order, revoked members excluded.
  // This hook still does not reject unauthenticated-but-workspaceless users —
  // signup, billing and workspace creation legitimately have no workspace yet.
  // Enforcement belongs to requireWorkspace() in tenancy.service.ts, which
  // fails closed at the point the data is actually touched.
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .eq('has_access', true)
    .is('suspended_at', null)
    .order('joined_at', { ascending: true })

  // Only populated when it is unambiguous. With several memberships the active
  // workspace must be chosen explicitly and verified by requireWorkspace();
  // picking one here would be the arbitrary choice defect (2) above.
  const sole = memberships?.length === 1 ? memberships[0] : undefined

  const result: CachedAuth = {
    user,
    role: sole?.role ?? '',
  }

  // ✅ FIX: ذخیره در کش برای درخواست‌های بعدی همین کاربر — await اضافه شد
  await memoryCache.set(cacheKey, result, resolveAuthCacheTtl(token))

  request.user = user
  request.userId = user.id
  request.userRole = result.role
}

export const authPreHandler = authenticate
