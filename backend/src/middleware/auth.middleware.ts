// ============================================
// backend/src/middleware/auth.middleware.ts
// FIXED: کش کردن نتیجه auth برای حذف کوئری تکراری
// روی هر درخواست (که سریالی و بدون ایندکس بود)
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

// ✅ TTL کش auth — کوتاه نگه داشته شده برای تعادل بین سرعت و امنیت
// (اگه نیاز به revoke فوری‌تر توکن/نقش داری، این عدد رو کمتر کن)
const AUTH_CACHE_TTL_MS = 30_000

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization
  if (!authHeader) {
    return reply.status(401).send({ error: 'Missing authorization header' })
  }

  const token = authHeader.replace('Bearer ', '')

  // ✅ FIX: چک کش قبل از هر کوئری
  const cacheKey = `auth:${token}`
  const cached = memoryCache.get<CachedAuth>(cacheKey)

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

  // ✅ FIX: ذخیره در کش برای درخواست‌های بعدی همین کاربر
  memoryCache.set(cacheKey, result, AUTH_CACHE_TTL_MS)

  request.user = user
  request.userId = user.id
  request.workspaceId = result.workspaceId
  request.userRole = result.role
}

export const authPreHandler = authenticate