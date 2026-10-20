// ============================================
// backend/src/services/admin/admin-security.service.ts
//
// Admin Security Service:
// - Admin accounts and roles lookup
// - Security events logging and filtering
// - Admin sessions list and revocation
// - TOTP Step-Up validation (<= 5 minutes validity)
// ============================================

import { supabase } from '../../db'
import { DatabaseError } from '../../errors/database.error'
import { isAllowlistedAdminEmail } from '../../middleware/platform-admin.middleware'
import { AdminRole, AdminPermission, hasAdminPermission } from './admin-rbac.domain'

export interface AdminAccount {
  id: string
  userId: string
  email: string
  role: AdminRole
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface AdminSecurityEvent {
  id: string
  eventType: string
  adminEmail: string | null
  ipAddress: string | null
  userAgent: string | null
  details: Record<string, unknown>
  createdAt: string
}

export interface SecurityEventFilter {
  eventType?: string | undefined
  adminEmail?: string | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export interface AdminSessionView {
  id: string
  userId: string
  adminEmail: string
  ip: string | null
  userAgent: string | null
  createdAt: string
  lastSignInAt: string | null
}

/** The claims of a Supabase access token this file reads. */
export interface AdminTokenClaims {
  aal?: string | undefined
  amr?: Array<{ method?: string | undefined; timestamp?: number | undefined } | string> | undefined
}

/**
 * The claims of the bearer token on this request. Only call it AFTER
 * `authenticate`: that middleware has verified the very same token with
 * `supabase.auth.getUser(token)`, so the payload read here is not forged.
 */
export function verifiedTokenClaims(authorization: string | undefined): AdminTokenClaims {
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : ''
  const payload = token.split('.')[1]
  if (!payload) return {}
  try {
    const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString(
      'utf8',
    )
    const parsed = JSON.parse(json) as AdminTokenClaims
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    // Not a JWT: no claims, so no MFA — the guards below refuse.
    return {}
  }
}

export class AdminSecurityService {
  /**
   * Resolves the admin's role from admin_accounts.
   * If not found, falls back to the platform-admin allowlist:
   * an allowlisted email without a row is bootstrapped with role 'SUPER'.
   */
  static async resolveAdminRole(userId: string, email?: string): Promise<AdminRole | null> {
    const { data, error } = await supabase
      .from('admin_accounts')
      .select('role, is_active')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      throw new DatabaseError('Failed to read admin account', error)
    }

    if (data) {
      return data.is_active ? (data.role as AdminRole) : null
    }

    // Check allowlisted email
    if (email) {
      if (isAllowlistedAdminEmail(email)) {
        // Auto-seed bootstrap SUPER admin
        await supabase.from('admin_accounts').upsert(
          {
            user_id: userId,
            email: email.toLowerCase(),
            role: 'SUPER',
            is_active: true,
          },
          { onConflict: 'user_id' },
        )
        return 'SUPER'
      }
    }

    return null
  }

  /**
   * Verifies if an admin has a given permission.
   */
  static async checkPermission(
    userId: string,
    email: string | undefined,
    permission: AdminPermission,
  ): Promise<boolean> {
    const role = await this.resolveAdminRole(userId, email)
    if (!role) return false
    return hasAdminPermission(role, permission)
  }

  /**
   * Records a security event.
   */
  static async logSecurityEvent(params: {
    eventType: string
    adminEmail?: string | null | undefined
    ipAddress?: string | null | undefined
    userAgent?: string | null | undefined
    details?: Record<string, unknown> | undefined
  }): Promise<void> {
    const { error } = await supabase.from('admin_security_events').insert({
      event_type: params.eventType,
      admin_email: params.adminEmail ?? null,
      ip_address: params.ipAddress ?? null,
      user_agent: params.userAgent ?? null,
      details: params.details ?? {},
    })

    if (error) {
      // Non-fatal logging failure
      console.error('[AdminSecurityService] Failed to log security event:', error)
    }
  }

  /**
   * Lists security events with filters.
   */
  static async listSecurityEvents(
    filters: SecurityEventFilter = {},
  ): Promise<{ events: AdminSecurityEvent[]; total: number }> {
    let query = supabase
      .from('admin_security_events')
      .select('id, event_type, admin_email, ip_address, user_agent, details, created_at', {
        count: 'exact',
      })
      .order('created_at', { ascending: false })

    if (filters.eventType) {
      query = query.eq('event_type', filters.eventType)
    }
    if (filters.adminEmail) {
      query = query.ilike('admin_email', `%${filters.adminEmail}%`)
    }

    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100)
    const offset = Math.max(filters.offset ?? 0, 0)

    query = query.range(offset, offset + limit - 1)

    const { data, count, error } = await query
    if (error) throw new DatabaseError('Failed to list security events', error)

    const events: AdminSecurityEvent[] = (data ?? []).map((row) => ({
      id: row.id,
      eventType: row.event_type,
      adminEmail: row.admin_email,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      details: row.details as Record<string, unknown>,
      createdAt: row.created_at,
    }))

    return { events, total: count ?? events.length }
  }

  /**
   * Lists active admin accounts.
   */
  static async listAdminAccounts(): Promise<AdminAccount[]> {
    const { data, error } = await supabase
      .from('admin_accounts')
      .select('id, user_id, email, role, is_active, created_at, updated_at')
      .order('created_at', { ascending: false })

    if (error) throw new DatabaseError('Failed to list admin accounts', error)

    return (data ?? []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      email: row.email,
      role: row.role as AdminRole,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
  }

  /**
   * Sets or updates an admin's role. (SUPER only)
   */
  static async upsertAdminAccount(params: {
    userId: string
    email: string
    role: AdminRole
    isActive?: boolean | undefined
  }): Promise<AdminAccount> {
    const { data, error } = await supabase
      .from('admin_accounts')
      .upsert(
        {
          user_id: params.userId,
          email: params.email.toLowerCase().trim(),
          role: params.role,
          is_active: params.isActive ?? true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )
      .select('id, user_id, email, role, is_active, created_at, updated_at')
      .single()

    if (error) throw new DatabaseError('Failed to upsert admin account', error)

    return {
      id: data.id,
      userId: data.user_id,
      email: data.email,
      role: data.role as AdminRole,
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
  }

  /**
   * Lists active admin sessions via Supabase admin auth API.
   */
  static async listAdminSessions(): Promise<AdminSessionView[]> {
    // Read allowlisted admin accounts
    const accounts = await this.listAdminAccounts()
    const sessions: AdminSessionView[] = []

    for (const acc of accounts) {
      try {
        const { data, error } = await supabase.auth.admin.getUserById(acc.userId)
        if (!error && data?.user) {
          sessions.push({
            id: `sess-${acc.userId}`,
            userId: acc.userId,
            adminEmail: acc.email,
            ip: null,
            userAgent: null,
            createdAt: data.user.created_at,
            lastSignInAt: data.user.last_sign_in_at ?? null,
          })
        }
      } catch {
        // Continue
      }
    }

    return sessions
  }

  /**
   * Revokes an admin's sessions via Supabase auth admin.
   */
  static async revokeAdminSession(userId: string, actorEmail: string): Promise<void> {
    const { error } = await supabase.auth.admin.signOut(userId)
    if (error) throw new DatabaseError('Failed to revoke admin session', error)

    await this.logSecurityEvent({
      eventType: 'SESSION_REVOKED',
      adminEmail: actorEmail,
      details: { targetUserId: userId },
    })
  }

  /**
   * When this session last passed a TOTP check, from the access token's `amr`
   * claim (Supabase writes `{ method: 'totp', timestamp }` on every
   * `mfa.verify`). `null` = never in this session.
   *
   * ⚠️ The previous version trusted a timestamp the BROWSER sent in a header,
   * and `POST /step-up` handed that timestamp out without checking any code —
   * so «step-up» was a button, not a check. The time now comes only from the
   * token that `authenticate` has already verified with Supabase.
   */
  static lastTotpAt(claims: AdminTokenClaims): number | null {
    let latest: number | null = null
    for (const entry of claims.amr ?? []) {
      if (
        typeof entry === 'object' &&
        entry?.method === 'totp' &&
        typeof entry.timestamp === 'number'
      ) {
        latest = latest === null ? entry.timestamp : Math.max(latest, entry.timestamp)
      }
    }
    return latest
  }

  /** A TOTP check within the last 5 minutes (and not from the future). */
  static isStepUpFresh(
    claims: AdminTokenClaims,
    nowSeconds = Math.floor(Date.now() / 1000),
  ): boolean {
    const at = AdminSecurityService.lastTotpAt(claims)
    return at !== null && at <= nowSeconds + 30 && at >= nowSeconds - 300
  }
}
