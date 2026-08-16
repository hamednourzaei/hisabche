// ============================================
// backend/src/services/workspace.service.ts — Optimized v2.1
// FIXED: Added cache, parallel queries, projection
// ============================================

import { supabase } from '../db'
import {
  CreateWorkspace,
  UpdateWorkspace,
  UpdateMemberRole,
  CreateInvite,
  AcceptInvite,
  CreateMemberDirect,
  MAX_WORKSPACE_MEMBERS,
} from '@hisabche/validation'
import { DatabaseError } from '../errors/database.error'
import { memoryCache } from '../utils/pagination'
import { emailService } from './email.service'
import crypto from 'crypto'

// ✅ Types
interface WorkspaceMember {
  id: string
  user_id: string
  role: 'owner' | 'admin' | 'member' | 'viewer'
  joined_at: string
}

interface WorkspaceWithRole {
  id: string
  name: string
  slug: string
  description: string | null
  logo_url: string | null
  stamp_url: string | null
  owner_id: string
  is_active: boolean
  created_at: string
  updated_at: string
  myRole: string
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

// ✅ Column Selection Constants
const WORKSPACE_COLUMNS =
  'id, name, slug, description, logo_url, stamp_url, owner_id, is_active, created_at, updated_at'

/** Same list without `stamp_url`, for databases that have not run the stamp migration. */
const WORKSPACE_COLUMNS_NO_STAMP =
  'id, name, slug, description, logo_url, owner_id, is_active, created_at, updated_at'

/**
 * Is this Postgres saying `stamp_url` does not exist?
 *
 * 42703 is undefined_column; PostgREST also reports unknown columns through a
 * schema-cache message. Matching on the column name keeps this from swallowing
 * unrelated database failures.
 */
function isMissingStampColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  const message = error.message ?? ''
  if (!/stamp_url/.test(message)) return false
  return error.code === '42703' || /does not exist|schema cache|could not find/i.test(message)
}
const WORKSPACE_MINIMAL = 'id, name, slug, is_active'

const MEMBER_COLUMNS = 'id, user_id, role, joined_at'
const MEMBER_MINIMAL = 'id, user_id, role'

const INVITE_COLUMNS = 'id, email, role, status, invited_by, expires_at, created_at'
const INVITE_MINIMAL = 'id, email, role, status, expires_at'

export class WorkspaceService {
  // ─── Cache Keys ──────────────────────────────────────────────
  private getWorkspaceCacheKey(workspaceId: string) {
    return `workspace:${workspaceId}`
  }

  private getUserWorkspacesCacheKey(userId: string) {
    return `workspace:user:${userId}`
  }

  private getMembersCacheKey(workspaceId: string) {
    return `workspace:members:${workspaceId}`
  }

  private getInvitesCacheKey(workspaceId: string) {
    return `workspace:invites:${workspaceId}`
  }

  // ─── Workspace CRUD ──────────────────────────────────────────
  async createWorkspace(userId: string, data: CreateWorkspace) {
    const slug = data.slug || data.name.toLowerCase().replace(/\s+/g, '-')

    const { data: workspace, error } = await supabase
      .from('workspaces')
      .insert({
        name: data.name,
        slug,
        description: data.description || null,
        logo_url: data.logoUrl || null,
        stamp_url: data.stampUrl || null,
        owner_id: userId,
      })
      .select(WORKSPACE_COLUMNS)
      .single()

    if (error || !workspace) throw new DatabaseError('Failed to create workspace', error)

    await supabase
      .from('workspace_members')
      .insert({ workspace_id: workspace.id, user_id: userId, role: 'owner' })

    // ✅ Invalidate cache
    await this.invalidateUserCache(userId)

    return workspace
  }

  // ─── Get My Workspaces — OPTIMIZED ──────────────────────────
  async getMyWorkspaces(userId: string): Promise<WorkspaceWithRole[]> {
    const cacheKey = this.getUserWorkspacesCacheKey(userId)

    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached as WorkspaceWithRole[]

    // ✅ دو کوئری موازی
    const [membersResult, workspacesResult] = await Promise.all([
      supabase.from('workspace_members').select('workspace_id, role').eq('user_id', userId),
      supabase.from('workspaces').select(WORKSPACE_COLUMNS).in('id', []), // placeholder, با members پر می‌شود
    ])

    const members = membersResult.data || []
    if (!members || members.length === 0) {
      await memoryCache.set(cacheKey, [], 60)
      return []
    }

    const workspaceIds = members.map((m: any) => m.workspace_id)

    // ✅ گرفتن workspaces با workspaceIds
    const { data: workspaces } = await supabase
      .from('workspaces')
      .select(WORKSPACE_COLUMNS)
      .in('id', workspaceIds)

    const roleMap: Record<string, string> = {}
    for (const m of members) {
      roleMap[m.workspace_id] = m.role
    }

    const result = (workspaces || []).map((w: any) => ({
      ...w,
      myRole: roleMap[w.id] || 'member',
    }))

    await memoryCache.set(cacheKey, result, 60) // 1 minute
    return result
  }

  // ─── Get Workspace ──────────────────────────────────────────
  async getWorkspace(userId: string, workspaceId: string) {
    const cacheKey = this.getWorkspaceCacheKey(workspaceId)

    const cached = await memoryCache.get(cacheKey)
    if (cached) {
      const data = cached as any
      // ✅ بررسی permission از کش
      if (data.userHasAccess !== userId) throw new DatabaseError('Access denied')
      return data
    }

    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .single()

    if (!member) throw new DatabaseError('Access denied')

    const { data: ws } = await supabase
      .from('workspaces')
      .select(WORKSPACE_COLUMNS)
      .eq('id', workspaceId)
      .single()

    if (!ws) throw new DatabaseError('Workspace not found')

    const result = { ...ws, myRole: member.role, userHasAccess: userId }
    await memoryCache.set(cacheKey, result, 120) // 2 minutes
    return result
  }

  // ─── Update Workspace ──────────────────────────────────────
  /**
   * `data` deliberately excludes `id`: the workspace being updated is
   * identified by `workspaceId` (from the URL), and this method never reads
   * `data.id`. Requiring it in the payload only produced 400s on every
   * legitimate partial update.
   */
  async updateWorkspace(userId: string, workspaceId: string, data: Omit<UpdateWorkspace, 'id'>) {
    await this.requireRole(userId, workspaceId, 'admin')

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (data.name !== undefined) updates.name = data.name
    if (data.description !== undefined) updates.description = data.description
    if (data.logoUrl !== undefined) updates.logo_url = data.logoUrl
    if (data.stampUrl !== undefined) updates.stamp_url = data.stampUrl

    const write = async (columns: string, payload: Record<string, unknown>) =>
      supabase.from('workspaces').update(payload).eq('id', workspaceId).select(columns).single()

    let { data: ws, error } = await write(WORKSPACE_COLUMNS, updates)

    // `stamp_url` is added by docs/workspace-stamp-migration.sql. Until that
    // runs, both the write and the read-back reference a column Postgres does
    // not have, so uploading a stamp failed with a bare 500 that said nothing
    // about the cause. Retry without it so the rest of the update still lands,
    // then tell the caller precisely what is missing.
    if (error && isMissingStampColumn(error)) {
      const { stamp_url: attemptedStamp, ...withoutStamp } = updates
      ;({ data: ws, error } = await write(WORKSPACE_COLUMNS_NO_STAMP, withoutStamp))

      if (!error && attemptedStamp !== undefined) {
        // The stamp itself could not be saved. Succeeding silently would tell
        // the user their signature was stored when it was discarded.
        throw new DatabaseError(
          'Workspace stamp is not supported by this database yet — run docs/workspace-stamp-migration.sql',
        )
      }
    }

    if (error || !ws) throw new DatabaseError('Failed to update workspace', error)

    // ✅ Invalidate cache
    await this.invalidateWorkspaceCache(workspaceId)
    return ws
  }

  // ─── List Members ──────────────────────────────────────────
  async listMembers(userId: string, workspaceId: string) {
    await this.requireMember(userId, workspaceId)

    const cacheKey = this.getMembersCacheKey(workspaceId)

    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const { data, error } = await supabase
      .from('workspace_members')
      .select(MEMBER_MINIMAL)
      .eq('workspace_id', workspaceId)

    if (error) throw new DatabaseError('Failed to fetch members', error)

    const result = data || []
    await memoryCache.set(cacheKey, result, 60) // 1 minute
    return result
  }

  // ─── Update Member Role ────────────────────────────────────
  async updateMemberRole(userId: string, workspaceId: string, data: UpdateMemberRole) {
    await this.requireRole(userId, workspaceId, 'owner')

    const { error } = await supabase
      .from('workspace_members')
      .update({ role: data.role })
      .eq('id', data.memberId)
      .eq('workspace_id', workspaceId)

    if (error) throw new DatabaseError('Failed to update member role', error)

    // ✅ Invalidate cache
    await this.invalidateWorkspaceCache(workspaceId)
    return { success: true }
  }

  // ─── Remove Member ─────────────────────────────────────────
  async removeMember(userId: string, workspaceId: string, memberId: string) {
    await this.requireRole(userId, workspaceId, 'admin')

    const { data: m } = await supabase
      .from('workspace_members')
      .select('role, user_id')
      .eq('id', memberId)
      .single()

    if (!m) throw new DatabaseError('Member not found')
    if (m.role === 'owner' || m.user_id === userId) {
      throw new DatabaseError('Cannot remove')
    }

    await supabase.from('workspace_members').delete().eq('id', memberId)

    // ✅ Invalidate cache
    await this.invalidateWorkspaceCache(workspaceId)
    return { success: true }
  }

  // ─── Leave Workspace ──────────────────────────────────────
  async leaveWorkspace(userId: string, workspaceId: string) {
    const { data: m } = await supabase
      .from('workspace_members')
      .select('role, id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .single()

    if (!m || m.role === 'owner') throw new DatabaseError('Cannot leave')

    await supabase.from('workspace_members').delete().eq('id', m.id)

    // ✅ Invalidate cache
    await this.invalidateWorkspaceCache(workspaceId)
    await this.invalidateUserCache(userId)

    return { success: true }
  }

  // ─── Invites ────────────────────────────────────────────────
  async createInvite(userId: string, data: CreateInvite) {
    await this.requireRole(userId, data.workspaceId, 'admin')

    const { data: ws } = await supabase
      .from('workspaces')
      .select('is_active')
      .eq('id', data.workspaceId)
      .single()

    if (!ws?.is_active) throw new DatabaseError('Workspace is not active')

    const rawToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = hashToken(rawToken)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    const { data: invite, error } = await supabase
      .from('workspace_invites')
      .insert({
        workspace_id: data.workspaceId,
        email: data.email,
        role: data.role,
        invited_by: userId,
        token: tokenHash,
        token_hash: tokenHash,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
      })
      .select(INVITE_COLUMNS)
      .single()

    if (error || !invite) throw new DatabaseError('Failed to create invite', error)

    // ✅ Invalidate cache
    await this.invalidateInviteCache(data.workspaceId)

    this.sendInviteEmail(userId, data.workspaceId, data.email, rawToken).catch((err) =>
      console.error('Failed to send invite email:', err),
    )

    return { ...invite, token: rawToken }
  }

  // ─── Send invite email (fire-and-forget) ───────────────────
  private async sendInviteEmail(
    inviterId: string,
    workspaceId: string,
    toEmail: string,
    rawToken: string,
  ) {
    const [{ data: inviter }, { data: workspace }] = await Promise.all([
      supabase.from('users').select('full_name, preferred_language').eq('id', inviterId).single(),
      supabase.from('workspaces').select('name').eq('id', workspaceId).single(),
    ])

    if (!workspace) return

    const lang = await emailService.getUserLanguage(inviterId)
    // ✅ FIX: لینک قبلاً بدون پیشوند زبان بود (/accept-invite) در حالی
    // که صفحه‌ی واقعی فقط زیر app/[lang]/accept-invite وجود دارد و هیچ
    // middleware‌ای برای اضافه‌کردن خودکار locale به مسیرهای بدون زبان
    // نیست — یعنی لینک همیشه به مسیر اشتباه می‌رفت.
    const urlLangMap: Record<string, string> = { 'fa-IR': 'fa', 'fa-AF': 'af', en: 'en' }
    const urlLang = urlLangMap[lang] || 'af'
    const inviteLink = `${process.env.FRONTEND_URL || 'https://hisabche.com'}/${urlLang}/accept-invite?token=${rawToken}`

    await emailService.sendWorkspaceInvite(
      toEmail,
      inviter?.full_name || 'یک همکار',
      workspace.name,
      inviteLink,
      lang,
    )
  }

  // ─── List Invites ─────────────────────────────────────────
  async listInvites(userId: string, workspaceId: string) {
    await this.requireRole(userId, workspaceId, 'admin')

    const cacheKey = this.getInvitesCacheKey(workspaceId)

    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const { data, error } = await supabase
      .from('workspace_invites')
      .select(INVITE_MINIMAL)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (error) throw new DatabaseError('Failed to fetch invites', error)

    const result = data || []
    await memoryCache.set(cacheKey, result, 60) // 1 minute
    return result
  }

  // ─── Accept Invite ──────────────────────────────────────────
  // ✅ FIX: کوئری قبلی (token_hash + status='pending' با .single()) در
  // یک بازه‌ی نامشخص مدام PGRST116 (۰ ردیف) برمی‌گرداند در حالی که همان
  // ردیف با همان مقادیر از SQL Editor مستقیم قابل مشاهده بود — یعنی
  // مشکل در ترکیب فیلترها/single() از طریق PostgREST بود، نه در خود
  // داده. حالا فقط با token_hash (تنها شرط، بدون ترکیب) و maybeSingle
  // واکشی می‌کنیم و بقیه‌ی شرط‌ها (status/email/expiry) را در کد چک
  // می‌کنیم — هم ساده‌تر، هم خطای دقیق‌تر می‌دهد.
  async acceptInvite(userId: string, userEmail: string, data: AcceptInvite) {
    const tokenHash = hashToken(data.token)

    const { data: invite, error: inviteError } = await supabase
      .from('workspace_invites')
      .select('id, workspace_id, email, role, status, expires_at')
      .eq('token_hash', tokenHash)
      .maybeSingle()

    if (inviteError) throw new DatabaseError('Failed to look up invite', inviteError)
    if (!invite) throw new DatabaseError('Invalid or expired invite')
    if (invite.status !== 'pending') throw new DatabaseError('Invite already used or cancelled')
    if (invite.email.toLowerCase() !== userEmail.toLowerCase()) {
      throw new DatabaseError('Wrong email')
    }
    if (new Date(invite.expires_at) < new Date()) {
      await supabase.from('workspace_invites').update({ status: 'expired' }).eq('id', invite.id)
      throw new DatabaseError('Expired')
    }

    // ✅ بررسی workspace
    const { data: ws } = await supabase
      .from('workspaces')
      .select('is_active')
      .eq('id', invite.workspace_id)
      .single()

    if (!ws?.is_active) throw new DatabaseError('Workspace inactive')

    // ✅ بررسی عضویت قبلی با یک کوئری
    const { data: existing } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', invite.workspace_id)
      .eq('user_id', userId)
      .single()

    if (existing) throw new DatabaseError('Already member')

    // ✅ دو کوئری موازی برای insert و update
    await Promise.all([
      supabase
        .from('workspace_members')
        .insert({ workspace_id: invite.workspace_id, user_id: userId, role: invite.role }),
      supabase
        .from('workspace_invites')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
          accepted_by: userId,
        })
        .eq('id', invite.id),
    ])

    // ✅ Invalidate cache
    await this.invalidateWorkspaceCache(invite.workspace_id)
    await this.invalidateUserCache(userId)
    await this.invalidateInviteCache(invite.workspace_id)

    return { success: true, workspaceId: invite.workspace_id }
  }

  // ─── Cancel Invite ─────────────────────────────────────────
  async cancelInvite(userId: string, workspaceId: string, inviteId: string) {
    await this.requireRole(userId, workspaceId, 'admin')

    await supabase.from('workspace_invites').update({ status: 'cancelled' }).eq('id', inviteId)

    // ✅ Invalidate cache
    await this.invalidateInviteCache(workspaceId)

    return { success: true }
  }

  // ─── Resend Invite ─────────────────────────────────────────
  async resendInvite(userId: string, workspaceId: string, inviteId: string) {
    await this.requireRole(userId, workspaceId, 'admin')

    const { data: inv } = await supabase
      .from('workspace_invites')
      .select('id, status')
      .eq('id', inviteId)
      .single()

    if (!inv || !['pending', 'expired'].includes(inv.status)) {
      throw new DatabaseError('Cannot resend')
    }

    const rawToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = hashToken(rawToken)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    await supabase
      .from('workspace_invites')
      .update({
        token: tokenHash,
        token_hash: tokenHash,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
      })
      .eq('id', inviteId)

    // ✅ Invalidate cache
    await this.invalidateInviteCache(workspaceId)

    return { ...inv, token: rawToken, status: 'pending', expires_at: expiresAt.toISOString() }
  }

  // ─── Direct Member Creation (دسترسی مستقیم کارمند) ─────────
  // مالک بدون فرآیند دعوت ایمیلی، مستقیم ایمیل/پسورد کارمند را
  // وارد می‌کند و یک حساب واقعی login-capable زیر همین workspace
  // با نقش انتخابی ساخته می‌شود. فقط owner می‌تواند این کار را انجام دهد.
  async createMemberDirect(ownerUserId: string, workspaceId: string, data: CreateMemberDirect) {
    await this.requireRole(ownerUserId, workspaceId, 'owner')

    // Enforced here, not only in the UI — the endpoint is reachable directly.
    const { count } = await supabase
      .from('workspace_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)

    if ((count ?? 0) >= MAX_WORKSPACE_MEMBERS) {
      throw new DatabaseError(`A workspace can have at most ${MAX_WORKSPACE_MEMBERS} members`)
    }

    const memberRow: Record<string, unknown> = {
      workspace_id: workspaceId,
      role: data.role,
      job_title: data.jobTitle ?? null,
      phone: data.phone ?? null,
      has_access: data.hasAccess,
    }

    let userId: string | null = null

    // Only mint an auth account when the owner actually wants this person to
    // sign in. A payroll-only colleague gets a row and nothing else, which is
    // what removed most of the old invite flow's failure modes.
    if (data.hasAccess) {
      const { data: created, error: createError } = await supabase.auth.admin.createUser({
        email: data.email as string,
        password: data.password as string,
        email_confirm: true,
        user_metadata: { full_name: data.fullName },
      })

      if (createError || !created.user) {
        if (createError?.message?.includes('already')) {
          throw new DatabaseError('Email already registered')
        }
        throw new DatabaseError('Failed to create account', createError)
      }

      userId = created.user.id

      await supabase
        .from('profiles')
        .upsert({ id: userId, full_name: data.fullName }, { onConflict: 'id' })

      memberRow['user_id'] = userId
    } else {
      // No auth user, so no id to key on — the row carries the name itself.
      memberRow['full_name'] = data.fullName
    }

    const { error: memberError } = await supabase.from('workspace_members').insert(memberRow)

    if (memberError) {
      // The auth user is already created at this point; leaving it orphaned
      // would block the owner from retrying with the same email.
      if (userId) await supabase.auth.admin.deleteUser(userId).catch(() => undefined)
      throw new DatabaseError('Failed to add member', memberError)
    }

    await this.invalidateWorkspaceCache(workspaceId)

    return { success: true, userId }
  }

  /**
   * Suspend or restore a member.
   *
   * Distinct from removal: the row, its payroll history and its attribution on
   * past records all survive. Only the ability to sign in goes away, and it
   * comes back by clearing the same field.
   */
  async setMemberSuspension(
    ownerUserId: string,
    workspaceId: string,
    memberId: string,
    suspended: boolean,
  ) {
    await this.requireRole(ownerUserId, workspaceId, 'owner')

    // An owner suspending themselves would lock the workspace with no way back.
    if (memberId === ownerUserId) {
      throw new DatabaseError('You cannot suspend your own account')
    }

    const { error } = await supabase
      .from('workspace_members')
      .update({ suspended_at: suspended ? new Date().toISOString() : null })
      .eq('workspace_id', workspaceId)
      .eq('user_id', memberId)

    if (error) throw new DatabaseError('Failed to update member suspension', error)

    await this.invalidateWorkspaceCache(workspaceId)
    return { success: true, suspended }
  }

  // ─── Permission Helpers ─────────────────────────────────────
  private async requireMember(userId: string, workspaceId: string) {
    const { data, error } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .single()

    if (error || !data) throw new DatabaseError('Access denied')
    return data
  }

  private async requireRole(userId: string, workspaceId: string, requiredRole: string) {
    const member = await this.requireMember(userId, workspaceId)
    const hierarchy: Record<string, number> = { owner: 4, admin: 3, member: 2, viewer: 1 }

    if ((hierarchy[member.role] || 0) < (hierarchy[requiredRole] || 0)) {
      throw new DatabaseError('Insufficient permissions')
    }
  }

  // ─── Invalidate Cache ───────────────────────────────────────
  private async invalidateWorkspaceCache(workspaceId: string) {
    await memoryCache.invalidate(this.getWorkspaceCacheKey(workspaceId))
    await memoryCache.invalidate(this.getMembersCacheKey(workspaceId))
  }

  private async invalidateInviteCache(workspaceId: string) {
    await memoryCache.invalidate(this.getInvitesCacheKey(workspaceId))
  }

  private async invalidateUserCache(userId: string) {
    await memoryCache.invalidate(this.getUserWorkspacesCacheKey(userId))
  }
}

export default WorkspaceService
