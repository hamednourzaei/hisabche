// ============================================
// backend/src/services/admin/admin-customers.service.ts
//
// Admin Customers & Support Service:
// - Workspace 360 data aggregator
// - User lifecycle actions (suspend, reactivate, revoke sessions, reset MFA, force signout)
// - Support impersonation sessions (short-lived, customer-visible)
// - Admin internal notes and tags
// - Customer data compliance requests (export 7d, delete 30d, anonymise, legal hold)
// - Trial-abuse signals aggregator
// ============================================

import { randomBytes } from 'node:crypto'
import { supabase } from '../../db'
import { DatabaseError, NotFoundError } from '../../errors/database.error'
import { AdminSecurityService } from './admin-security.service'

export interface Workspace360Data {
  workspace: {
    id: string
    name: string
    created_at: string
    is_active?: boolean
  }
  members: Array<{
    id: string
    user_id: string
    role: string
    created_at: string
    email?: string | null
  }>
  subscriptions: unknown[]
  devices: unknown[]
  licences: unknown[]
  notes: Array<{
    id: string
    admin_email: string
    note: string
    tags: string[]
    created_at: string
  }>
  supportSessions: Array<{
    id: string
    admin_email: string
    reason: string
    expires_at: string
    is_revoked: boolean
    created_at: string
  }>
  dataRequests: Array<{
    id: string
    request_type: string
    status: string
    sla_due_at: string
    legal_hold: boolean
    created_at: string
  }>
}

export type UserLifecycleAction =
  'suspend' | 'reactivate' | 'revoke_sessions' | 'reset_mfa' | 'force_signout'

export class AdminCustomersService {
  /**
   * Builds the comprehensive Workspace 360 view.
   */
  static async getWorkspace360(workspaceId: string): Promise<Workspace360Data> {
    // 1. Workspace details
    const { data: ws, error: wsError } = await supabase
      .from('workspaces')
      .select('id, name, created_at')
      .eq('id', workspaceId)
      .maybeSingle()

    if (wsError) throw new DatabaseError(wsError.message)
    if (!ws) throw new NotFoundError('Workspace not found')

    // 2. Members
    const { data: members, error: mError } = await supabase
      .from('workspace_members')
      .select('id, user_id, role, created_at')
      .eq('workspace_id', workspaceId)

    if (mError) throw new DatabaseError(mError.message)

    // 3. Subscriptions (if table exists)
    const { data: subs } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(10)

    // 4. Notes
    const { data: notes, error: notesError } = await supabase
      .from('admin_notes')
      .select('id, admin_email, note, tags, created_at')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (notesError) throw new DatabaseError(notesError.message)

    // 5. Support sessions
    const { data: sessions, error: sessError } = await supabase
      .from('support_sessions')
      .select('id, admin_email, reason, expires_at, is_revoked, created_at')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (sessError) throw new DatabaseError(sessError.message)

    // 6. Data requests
    const { data: requests, error: reqError } = await supabase
      .from('admin_data_requests')
      .select('id, request_type, status, sla_due_at, legal_hold, created_at')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (reqError) throw new DatabaseError(reqError.message)

    return {
      workspace: ws,
      members: members ?? [],
      subscriptions: subs ?? [],
      devices: [],
      licences: [],
      notes: notes ?? [],
      supportSessions: sessions ?? [],
      dataRequests: requests ?? [],
    }
  }

  /**
   * Manages user lifecycle state (never sets password).
   */
  static async manageUser(
    userId: string,
    action: UserLifecycleAction,
    actorEmail: string,
  ): Promise<{ success: boolean; message: string }> {
    switch (action) {
      case 'suspend': {
        await supabase.auth.admin.updateUserById(userId, {
          ban_duration: '876000h', // ~100 years
        })
        break
      }
      case 'reactivate': {
        await supabase.auth.admin.updateUserById(userId, {
          ban_duration: 'none',
        })
        break
      }
      case 'revoke_sessions':
      case 'force_signout': {
        await supabase.auth.admin.signOut(userId, 'global')
        break
      }
      case 'reset_mfa': {
        const { data } = await supabase.auth.admin.mfa.listFactors({ userId })
        if (data?.factors) {
          for (const factor of data.factors) {
            await supabase.auth.admin.mfa.deleteFactor({ id: factor.id, userId })
          }
        }
        break
      }
    }

    await AdminSecurityService.logSecurityEvent({
      eventType: `USER_${action.toUpperCase()}`,
      adminEmail: actorEmail,
      details: { targetUserId: userId, action },
    })

    return { success: true, message: `Action ${action} executed successfully` }
  }

  /**
   * Creates a short-lived support impersonation session.
   */
  static async createSupportSession(params: {
    workspaceId: string
    adminId: string
    adminEmail: string
    reason: string
    durationMinutes?: number | undefined
  }) {
    const token = `sup_${randomBytes(24).toString('hex')}`
    const duration = Math.min(Math.max(params.durationMinutes ?? 60, 5), 240) // 5m - 4h
    const expiresAt = new Date(Date.now() + duration * 60 * 1000).toISOString()

    const { data, error } = await supabase
      .from('support_sessions')
      .insert({
        workspace_id: params.workspaceId,
        admin_id: params.adminId,
        admin_email: params.adminEmail,
        token,
        reason: params.reason,
        expires_at: expiresAt,
      })
      .select()
      .single()

    if (error) throw new DatabaseError(error.message)

    await AdminSecurityService.logSecurityEvent({
      eventType: 'SUPPORT_SESSION_CREATED',
      adminEmail: params.adminEmail,
      details: {
        workspaceId: params.workspaceId,
        reason: params.reason,
        durationMinutes: duration,
      },
    })

    return data
  }

  /**
   * Adds an internal note to a workspace.
   */
  static async addNote(params: {
    workspaceId: string
    adminId: string
    adminEmail: string
    note: string
    tags?: string[] | undefined
  }) {
    const { data, error } = await supabase
      .from('admin_notes')
      .insert({
        workspace_id: params.workspaceId,
        admin_id: params.adminId,
        admin_email: params.adminEmail,
        note: params.note,
        tags: params.tags ?? [],
      })
      .select()
      .single()

    if (error) throw new DatabaseError(error.message)
    return data
  }

  /**
   * Lists customer data compliance requests.
   */
  static async listDataRequests(workspaceId?: string | undefined) {
    let query = supabase
      .from('admin_data_requests')
      .select('*')
      .order('created_at', { ascending: false })

    if (workspaceId) {
      query = query.eq('workspace_id', workspaceId)
    }

    const { data, error } = await query
    if (error) throw new DatabaseError(error.message)
    return data ?? []
  }

  /**
   * Creates a data request (export, delete, anonymise).
   */
  static async createDataRequest(params: {
    workspaceId: string
    requestType: 'EXPORT' | 'DELETE' | 'ANONYMISE'
    legalHold?: boolean | undefined
    adminNotes?: string | undefined
  }) {
    const slaDays = params.requestType === 'EXPORT' ? 7 : 30
    const slaDueAt = new Date(Date.now() + slaDays * 24 * 60 * 60 * 1000).toISOString()

    const { data, error } = await supabase
      .from('admin_data_requests')
      .insert({
        workspace_id: params.workspaceId,
        request_type: params.requestType,
        sla_due_at: slaDueAt,
        legal_hold: params.legalHold ?? false,
        admin_notes: params.adminNotes,
      })
      .select()
      .single()

    if (error) throw new DatabaseError(error.message)
    return data
  }

  /**
   * Lists trial abuse signals.
   */
  static async listTrialAbuseSignals() {
    const { data, error } = await supabase
      .from('trial_abuse_signals')
      .select('*')
      .order('last_seen_at', { ascending: false })
      .limit(100)

    if (error) throw new DatabaseError(error.message)
    return data ?? []
  }
}
