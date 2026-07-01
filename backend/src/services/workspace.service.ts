// ============================================
// backend/src/services/workspace.service.ts
// ============================================

import { supabase } from '../db'
import {
  CreateWorkspace,
  UpdateWorkspace,
  CreateWorkspaceMember,
  UpdateMemberRole,
  CreateInvite,
  AcceptInvite,
} from '@hisabche/validation'
import { DatabaseError } from '../errors/database.error'
import crypto from 'crypto'

export class WorkspaceService {
  // ─── Workspace ────────────────────────────────────────────
  async createWorkspace(userId: string, data: CreateWorkspace) {
    const slug = data.slug || data.name.toLowerCase().replace(/\s+/g, '-')

    const { data: workspace, error } = await supabase
      .from('workspaces')
      .insert({
        name: data.name,
        slug,
        description: data.description || null,
        logo_url: data.logoUrl || null,
        owner_id: userId,
      })
      .select()
      .single()

    if (error || !workspace) throw new DatabaseError('Failed to create workspace', error)

    // اضافه کردن creator به عنوان owner
    await supabase.from('workspace_members').insert({
      workspace_id: workspace.id,
      user_id: userId,
      role: 'owner',
    })

    return workspace
  }

  async getMyWorkspaces(userId: string) {
    const { data: memberships, error } = await supabase
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', userId)

    if (error) throw new DatabaseError('Failed to fetch memberships', error)
    if (!memberships || memberships.length === 0) return []

    const workspaceIds = memberships.map(m => m.workspace_id)

    const { data: workspaces, error: wsError } = await supabase
      .from('workspaces')
      .select('*')
      .in('id', workspaceIds)

    if (wsError) throw new DatabaseError('Failed to fetch workspaces', wsError)

    return (workspaces || []).map(ws => ({
      ...ws,
      myRole: memberships.find(m => m.workspace_id === ws.id)?.role || 'member',
    }))
  }

  async getWorkspace(userId: string, workspaceId: string) {
    // بررسی عضویت
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .single()

    if (!member) throw new DatabaseError('Access denied')

    const { data: workspace, error } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', workspaceId)
      .single()

    if (error || !workspace) throw new DatabaseError('Workspace not found', error)

    return { ...workspace, myRole: member.role }
  }

  async updateWorkspace(userId: string, workspaceId: string, data: UpdateWorkspace) {
    await this.requireRole(userId, workspaceId, 'admin')

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (data.name !== undefined) updates.name = data.name
    if (data.description !== undefined) updates.description = data.description
    if (data.logoUrl !== undefined) updates.logo_url = data.logoUrl

    const { data: workspace, error } = await supabase
      .from('workspaces')
      .update(updates)
      .eq('id', workspaceId)
      .select()
      .single()

    if (error || !workspace) throw new DatabaseError('Failed to update workspace', error)
    return workspace
  }

  // ─── Members ──────────────────────────────────────────────
  async listMembers(userId: string, workspaceId: string) {
    await this.requireMember(userId, workspaceId)

    const { data, error } = await supabase
      .from('workspace_members')
      .select('id, user_id, role, joined_at')
      .eq('workspace_id', workspaceId)

    if (error) throw new DatabaseError('Failed to fetch members', error)
    return data || []
  }

  async updateMemberRole(userId: string, workspaceId: string, data: UpdateMemberRole) {
    await this.requireRole(userId, workspaceId, 'owner')

    const { error } = await supabase
      .from('workspace_members')
      .update({ role: data.role })
      .eq('id', data.memberId)
      .eq('workspace_id', workspaceId)

    if (error) throw new DatabaseError('Failed to update member role', error)
    return { success: true }
  }

  async removeMember(userId: string, workspaceId: string, memberId: string) {
    await this.requireRole(userId, workspaceId, 'admin')

    // نمی‌توان owner را حذف کرد
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role, user_id')
      .eq('id', memberId)
      .eq('workspace_id', workspaceId)
      .single()

    if (!member) throw new DatabaseError('Member not found')
    if (member.role === 'owner') throw new DatabaseError('Cannot remove owner')
    if (member.user_id === userId) throw new DatabaseError('Cannot remove yourself — use leave instead')

    const { error } = await supabase
      .from('workspace_members')
      .delete()
      .eq('id', memberId)
      .eq('workspace_id', workspaceId)

    if (error) throw new DatabaseError('Failed to remove member', error)
    return { success: true }
  }

  async leaveWorkspace(userId: string, workspaceId: string) {
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role, id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .single()

    if (!member) throw new DatabaseError('Not a member')
    if (member.role === 'owner') throw new DatabaseError('Owner cannot leave — transfer ownership first')

    const { error } = await supabase
      .from('workspace_members')
      .delete()
      .eq('id', member.id)

    if (error) throw new DatabaseError('Failed to leave workspace', error)
    return { success: true }
  }

  // ─── Invites ──────────────────────────────────────────────
  async createInvite(userId: string, data: CreateInvite) {
    await this.requireRole(userId, data.workspaceId, 'admin')

    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // ۷ روز اعتبار

    const { data: invite, error } = await supabase
      .from('workspace_invites')
      .insert({
        workspace_id: data.workspaceId,
        email: data.email,
        role: data.role,
        invited_by: userId,
        token,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single()

    if (error || !invite) throw new DatabaseError('Failed to create invite', error)
    return invite
  }

  async listInvites(userId: string, workspaceId: string) {
    await this.requireRole(userId, workspaceId, 'admin')

    const { data, error } = await supabase
      .from('workspace_invites')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (error) throw new DatabaseError('Failed to fetch invites', error)
    return data || []
  }

  async acceptInvite(userId: string, data: AcceptInvite) {
    // یافتن دعوت‌نامه
    const { data: invite, error: inviteError } = await supabase
      .from('workspace_invites')
      .select('*')
      .eq('token', data.token)
      .eq('status', 'pending')
      .single()

    if (inviteError || !invite) throw new DatabaseError('Invalid or expired invite')

    // بررسی انقضا
    if (new Date(invite.expires_at) < new Date()) {
      await supabase
        .from('workspace_invites')
        .update({ status: 'expired' })
        .eq('id', invite.id)
      throw new DatabaseError('Invite has expired')
    }

    // بررسی عضویت قبلی
    const { data: existing } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', invite.workspace_id)
      .eq('user_id', userId)
      .single()

    if (existing) throw new DatabaseError('Already a member')

    // اضافه کردن عضو
    const { error: memberError } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: invite.workspace_id,
        user_id: userId,
        role: invite.role,
      })

    if (memberError) throw new DatabaseError('Failed to join workspace', memberError)

    // به‌روزرسانی وضعیت دعوت‌نامه
    await supabase
      .from('workspace_invites')
      .update({ status: 'accepted' })
      .eq('id', invite.id)

    return { success: true, workspaceId: invite.workspace_id }
  }

  async cancelInvite(userId: string, workspaceId: string, inviteId: string) {
    await this.requireRole(userId, workspaceId, 'admin')

    const { error } = await supabase
      .from('workspace_invites')
      .update({ status: 'cancelled' })
      .eq('id', inviteId)
      .eq('workspace_id', workspaceId)

    if (error) throw new DatabaseError('Failed to cancel invite', error)
    return { success: true }
  }

  // ─── Helpers ──────────────────────────────────────────────
  private async requireMember(userId: string, workspaceId: string) {
    const { data } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .single()

    if (!data) throw new DatabaseError('Access denied')
    return data
  }

  private async requireRole(userId: string, workspaceId: string, requiredRole: string) {
    const member = await this.requireMember(userId, workspaceId)

    const roleHierarchy: Record<string, number> = {
      owner: 4,
      admin: 3,
      member: 2,
      viewer: 1,
    }

    if ((roleHierarchy[member.role] || 0) < (roleHierarchy[requiredRole] || 0)) {
      throw new DatabaseError('Insufficient permissions')
    }
  }
}