// ============================================
// backend/src/services/admin/admin-ip-allowlist.service.ts
//
// V63 · S-5 — an OPTIONAL admin IP allow-list, with a break-glass path.
//
// ⚠️ EMPTY MEANS OFF. A fresh deployment has no rows and nothing changes; the
// owner opts in by adding one. A half-configured list that locked everyone out
// would be worse than no list at all, so the table is the switch.
//
// ⚠️ BREAK-GLASS. A wrong entry can lock the owner out of their own console.
// The configured break-glass email may always reach `/api/admin/security/*`
// (where the list is edited) even from an unlisted address. Every use is a
// security event, so it is visible rather than silent.
//
// Enforcement point: `platformAdminGuard`, which every admin-only route has —
// including the ones that do not carry a permission (`/security/step-up`).
// ============================================

import { supabase } from '../../db'
import { DatabaseError } from '../../errors/database.error'
import { cacheService } from '../cache.service'
import { ipMatchesAny } from '../../utils/ip-cidr'
import { AdminSecurityService } from './admin-security.service'

export interface AdminIpAllowlistEntry {
  id: string
  cidr: string
  label: string
  createdBy: string | null
  createdAt: string
}

export type AdminIpReason = 'disabled' | 'listed' | 'break_glass' | 'not_listed'

export interface AdminIpDecision {
  allowed: boolean
  reason: AdminIpReason
}

const CACHE_KEY = 'admin:ip-allowlist'
const CACHE_TTL_SECONDS = 60
const SCHEMA_ABSENT = new Set(['42P01', 'PGRST205'])

/**
 * Pure decision, so the rules can be tested without a database.
 *
 * `entries` is the configured CIDR list; an empty list is «the feature is off».
 */
export function decideAdminIpAccess(input: {
  path: string
  email: string | undefined
  ip: string | undefined
  entries: readonly string[]
  breakGlassEmail: string | null
}): AdminIpDecision {
  if (input.entries.length === 0) return { allowed: true, reason: 'disabled' }

  if (input.ip && ipMatchesAny(input.ip, input.entries)) {
    return { allowed: true, reason: 'listed' }
  }

  const email = input.email?.trim().toLowerCase()
  const breakGlass = input.breakGlassEmail?.trim().toLowerCase()
  if (
    email &&
    breakGlass &&
    email === breakGlass &&
    input.path.startsWith('/api/admin/security/')
  ) {
    return { allowed: true, reason: 'break_glass' }
  }

  return { allowed: false, reason: 'not_listed' }
}

class AdminIpAllowlistService {
  async listEntries(): Promise<AdminIpAllowlistEntry[]> {
    const { data, error } = await supabase
      .from('admin_ip_allowlist')
      .select('id, cidr, label, created_by, created_at')
      .order('created_at', { ascending: true })

    if (error) {
      // The migration has not been applied: the feature is off, and saying so
      // as an empty list is the truth — not an error page for every admin.
      if (SCHEMA_ABSENT.has(error.code)) return []
      throw new DatabaseError('Failed to read the admin IP allow-list', error)
    }

    return (
      (data ?? []) as Array<{
        id: string
        cidr: string
        label: string | null
        created_by: string | null
        created_at: string
      }>
    ).map((row) => ({
      id: row.id,
      cidr: row.cidr,
      label: row.label ?? '',
      createdBy: row.created_by,
      createdAt: row.created_at,
    }))
  }

  async addEntry(input: {
    cidr: string
    label: string
    actorEmail: string
  }): Promise<AdminIpAllowlistEntry> {
    const { data, error } = await supabase
      .from('admin_ip_allowlist')
      .insert({ cidr: input.cidr.trim(), label: input.label, created_by: input.actorEmail })
      .select('id, cidr, label, created_by, created_at')
      .single()

    if (error) throw new DatabaseError('Failed to add the IP allow-list entry', error)
    await cacheService.del(CACHE_KEY)

    const row = data as {
      id: string
      cidr: string
      label: string | null
      created_by: string | null
      created_at: string
    }
    return {
      id: row.id,
      cidr: row.cidr,
      label: row.label ?? '',
      createdBy: row.created_by,
      createdAt: row.created_at,
    }
  }

  async removeEntry(id: string): Promise<void> {
    const { error } = await supabase.from('admin_ip_allowlist').delete().eq('id', id)
    if (error) throw new DatabaseError('Failed to remove the IP allow-list entry', error)
    await cacheService.del(CACHE_KEY)
  }

  /** Cached for a minute: this runs on every admin request. */
  private async cidrs(): Promise<string[]> {
    const cached = await cacheService.get<string[]>(CACHE_KEY)
    if (Array.isArray(cached)) return cached

    const entries = await this.listEntries()
    const cidrs = entries.map((entry) => entry.cidr)
    await cacheService.set(CACHE_KEY, cidrs, CACHE_TTL_SECONDS)
    return cidrs
  }

  /**
   * The enforcement the guard calls. `null` = allowed; otherwise the refusal
   * to send. A break-glass use and every refusal become security events.
   */
  async enforce(input: {
    path: string
    email: string | undefined
    ip: string | undefined
    userAgent: string | undefined
    /**
     * Who may always reach `/api/admin/security/*`. RESOLVED BY THE CALLER
     * (`platformAdminGuard`) so that the environment reader for the admin
     * allow-list stays in exactly one file — the constitution guard asserts it.
     */
    breakGlassEmail: string | null
  }): Promise<{ error: string; code: string } | null> {
    const entries = await this.cidrs()
    const decision = decideAdminIpAccess({
      path: input.path,
      email: input.email,
      ip: input.ip,
      entries,
      breakGlassEmail: input.breakGlassEmail,
    })

    if (decision.reason === 'break_glass') {
      await AdminSecurityService.logSecurityEvent({
        eventType: 'ADMIN_IP_BREAK_GLASS',
        adminEmail: input.email,
        ipAddress: input.ip,
        userAgent: input.userAgent,
        details: { path: input.path },
      })
      return null
    }

    if (decision.allowed) return null

    await AdminSecurityService.logSecurityEvent({
      eventType: 'ADMIN_IP_REFUSED',
      adminEmail: input.email,
      ipAddress: input.ip,
      userAgent: input.userAgent,
      details: { path: input.path },
    })

    return {
      error: 'This address is not on the admin IP allow-list',
      code: 'ADMIN_IP_NOT_ALLOWED',
    }
  }
}

/**
 * The reader lives in `middleware/platform-admin.middleware.ts`, beside the
 * allow-list itself: the constitution guard asserts that the environment
 * variable has exactly one reader in the backend.
 */
export const adminIpAllowlistService = new AdminIpAllowlistService()
