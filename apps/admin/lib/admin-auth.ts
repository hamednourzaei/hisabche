// ============================================
// apps/admin/lib/admin-auth.ts
// Platform admin authorization layer – built on top of existing Supabase auth.
//
// IMPORTANT: This does NOT use workspace roles (owner/admin/member) as platform
// admin permissions. Those roles are customer organization-specific.
//
// Current implementation:
// - Environment-controlled email allowlist (ADMIN_ALLOWED_EMAILS) for Phase 1.
// - Ready for future migration to: platform_roles table OR profiles.is_platform_admin.
//
// Migration path:
// 1. Create a `platform_roles` table or `profiles.is_platform_admin` column
// 2. Replace `isPlatformAdmin()` implementation
// 3. Update middleware to use the new check
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseServer } from './supabase-server'

/**
 * Load the admin email allowlist from environment.
 * Comma-separated emails: ADMIN_ALLOWED_EMAILS="admin@hisabche.com,dev@hisabche.com"
 */
const ADMIN_ALLOWED_EMAILS = (() => {
  const raw = process.env.ADMIN_ALLOWED_EMAILS || ''
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
})()

/**
 * Check if a given email is in the platform admin allowlist.
 *
 * TODO (FUTURE): Replace this with a database-backed check:
 * - Option A: SELECT 1 FROM platform_roles WHERE email = ? AND role IN ('super_admin', 'support_agent', 'billing_manager')
 * - Option B: SELECT is_platform_admin FROM profiles WHERE id = ?
 * - Option C: Server-side claims from Supabase JWT
 */
export function isEmailPlatformAdmin(email: string | null): boolean {
  if (!email) return false
  const normalized = email.toLowerCase().trim()
  return ADMIN_ALLOWED_EMAILS.includes(normalized)
}

/**
 * Check if the user has platform admin privileges.
 *
 * Takes only what it actually reads. The previous signature also accepted a
 * `userId` and silently ignored it, which read as though identity mattered here
 * when the decision is purely the email allowlist — exactly the kind of thing
 * that leads someone to assume a user-scoped check is happening.
 *
 * When this moves to a database-backed check (see the migration note at the top
 * of this file), it becomes async and takes the id for real.
 */
export function isPlatformAdmin(email: string | null): boolean {
  return isEmailPlatformAdmin(email)
}

/**
 * Resolve the current session and verify platform admin status.
 * Reuses the existing Supabase client (shared with apps/web).
 */
export async function getPlatformAdminSession(): Promise<{
  isAdmin: boolean
  user: { id: string; email: string | null } | null
  error: string | null
}> {
  const supabase = await createAdminSupabaseServer()

  // `getUser()`, never `getSession()`.
  //
  // On the server `getSession()` decodes the cookie WITHOUT verifying the JWT
  // signature, so a forged or expired cookie would have satisfied this guard —
  // and this guard is what stands between an ordinary account and the platform
  // admin panel. `getUser()` validates the token against the Supabase auth
  // server. `middleware.ts` already did this; these helpers did not.
  const { data, error: authError } = await supabase.auth.getUser()
  const authUser = data.user

  if (authError || !authUser) {
    return { isAdmin: false, user: null, error: 'Not authenticated' }
  }

  const email = authUser.email ?? null
  const { isAdmin, error } = await verifyPlatformAdmin(authUser.id, email)

  return {
    isAdmin,
    user: { id: authUser.id, email },
    error: error ?? null,
  }
}

/**
 * Verify if a user is a platform admin.
 *
 * Current implementation: Check the ENV allowlist.
 * Future implementation: Query the database for `profiles.is_platform_admin = true`.
 */
async function verifyPlatformAdmin(
  // Underscored because the allowlist ignores it — it is kept for the
  // database-backed check sketched below, which needs the id. Same convention
  // as `_req` elsewhere in this file.
  _userId: string,
  email: string | null,
): Promise<{ isAdmin: boolean; error?: string }> {
  // Current: env-based allowlist
  if (isEmailPlatformAdmin(email)) {
    return { isAdmin: true }
  }

  // Future: If you add a `profiles` table with `is_platform_admin` column:
  // const { data: profile } = await supabase.from('profiles').select('is_platform_admin').eq('id', userId).single()
  // return { isAdmin: profile?.is_platform_admin === true }

  return { isAdmin: false, error: 'User is not a platform admin' }
}

/**
 * Guard for server components / API routes.
 * Throws AdminUnauthorizedError on failure.
 */
export async function requirePlatformAdmin(
  _req?: NextRequest,
): Promise<{ userId: string; email: string | null }> {
  const { isAdmin, user, error } = await getPlatformAdminSession()
  if (!isAdmin) {
    throw new AdminUnauthorizedError(error || 'Platform admin access required')
  }
  return { userId: user!.id, email: user!.email }
}

export class AdminUnauthorizedError extends Error {
  constructor(message: string = 'Platform admin access required') {
    super(message)
    this.name = 'AdminUnauthorizedError'
  }
}

/**
 * API route guard helper.
 * Returns a 401/403 JSON response when unauthorized, or the admin user when authorized.
 */
export async function platformAdminApiGuard(
  _req: NextRequest,
): Promise<
  { ok: true; userId: string; email: string | null } | { ok: false; response: NextResponse }
> {
  const { isAdmin, user, error } = await getPlatformAdminSession()

  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  if (!isAdmin) {
    return {
      ok: false,
      response: NextResponse.json({ error: error || 'Forbidden' }, { status: 403 }),
    }
  }

  return { ok: true, userId: user.id, email: user.email }
}
