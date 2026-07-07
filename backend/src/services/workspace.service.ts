// ============================================
// backend/src/services/workspace.service.ts
// Hisabche v1.1 — Enterprise Invite System
// ✅ Token Hash (SHA256)
// ✅ Email Match Check
// ✅ Resend Invite
// ✅ Duplicate Membership Check
// ✅ Workspace Status Check
// ============================================

import { supabase } from '../db'
import {
  CreateWorkspace,
  UpdateWorkspace,
  UpdateMemberRole,
  CreateInvite,
  AcceptInvite,
} from '@hisabche/validation'
import { DatabaseError } from '../errors/database.error'
import crypto from 'crypto'

// SHA256 hash for secure token storage
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export class WorkspaceService {
  async createWorkspace(userId: string, data: CreateWorkspace) {
    const slug = data.slug || data.name.toLowerCase().replace(/\s+/g, '-')
    const { data: workspace, error } = await supabase.from('workspaces').insert({
      name: data.name, slug, description: data.description || null,
      logo_url: data.logoUrl || null, owner_id: userId,
    }).select().single()
    if (error || !workspace) throw new DatabaseError('Failed to create workspace', error)
    await supabase.from('workspace_members').insert({ workspace_id: workspace.id, user_id: userId, role: 'owner' })
    return workspace
  }

  async getMyWorkspaces(userId: string) {
    const { data: memberships, error } = await supabase.from('workspace_members').select('workspace_id, role').eq('user_id', userId)
    if (error) throw new DatabaseError('Failed to fetch memberships', error)
    if (!memberships?.length) return []
    const ids = memberships.map(m => m.workspace_id)
    const { data: workspaces, error: wsError } = await supabase.from('workspaces').select('*').in('id', ids)
    if (wsError) throw new DatabaseError('Failed to fetch workspaces', wsError)
    return (workspaces || []).map(ws => ({ ...ws, myRole: memberships.find(m => m.workspace_id === ws.id)?.role || 'member' }))
  }

  async getWorkspace(userId: string, workspaceId: string) {
    const { data: member } = await supabase.from('workspace_members').select('role').eq('workspace_id', workspaceId).eq('user_id', userId).single()
    if (!member) throw new DatabaseError('Access denied')
    const { data: workspace, error } = await supabase.from('workspaces').select('*').eq('id', workspaceId).single()
    if (error || !workspace) throw new DatabaseError('Workspace not found', error)
    return { ...workspace, myRole: member.role }
  }

  async updateWorkspace(userId: string, workspaceId: string, data: UpdateWorkspace) {
    await this.requireRole(userId, workspaceId, 'admin')
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (data.name !== undefined) updates.name = data.name
    if (data.description !== undefined) updates.description = data.description
    if (data.logoUrl !== undefined) updates.logo_url = data.logoUrl
    const { data: workspace, error } = await supabase.from('workspaces').update(updates).eq('id', workspaceId).select().single()
    if (error || !workspace) throw new DatabaseError('Failed to update workspace', error)
    return workspace
  }

  async listMembers(userId: string, workspaceId: string) {
    await this.requireMember(userId, workspaceId)
    const { data, error } = await supabase.from('workspace_members').select('id, user_id, role, joined_at').eq('workspace_id', workspaceId)
    if (error) throw new DatabaseError('Failed to fetch members', error)
    return data || []
  }

  async updateMemberRole(userId: string, workspaceId: string, data: UpdateMemberRole) {
    await this.requireRole(userId, workspaceId, 'owner')
    const { error } = await supabase.from('workspace_members').update({ role: data.role }).eq('id', data.memberId).eq('workspace_id', workspaceId)
    if (error) throw new DatabaseError('Failed to update member role', error)
    return { success: true }
  }

  async removeMember(userId: string, workspaceId: string, memberId: string) {
    await this.requireRole(userId, workspaceId, 'admin')
    const { data: member } = await supabase.from('workspace_members').select('role, user_id').eq('id', memberId).eq('workspace_id', workspaceId).single()
    if (!member) throw new DatabaseError('Member not found')
    if (member.role === 'owner') throw new DatabaseError('Cannot remove owner')
    if (member.user_id === userId) throw new DatabaseError('Cannot remove yourself')
    const { error } = await supabase.from('workspace_members').delete().eq('id', memberId).eq('workspace_id', workspaceId)
    if (error) throw new DatabaseError('Failed to remove member', error)
    return { success: true }
  }

  async leaveWorkspace(userId: string, workspaceId: string) {
    const { data: member } = await supabase.from('workspace_members').select('role, id').eq('workspace_id', workspaceId).eq('user_id', userId).single()
    if (!member) throw new DatabaseError('Not a member')
    if (member.role === 'owner') throw new DatabaseError('Owner cannot leave')
    const { error } = await supabase.from('workspace_members').delete().eq('id', member.id)
    if (error) throw new DatabaseError('Failed to leave workspace', error)
    return { success: true }
  }

  // ═══════════════════════════════════════════════════════════
  // INVITES — Enterprise Grade
  // ═══════════════════════════════════════════════════════════

  async createInvite(userId: string, data: CreateInvite) {
    await this.requireRole(userId, data.workspaceId, 'admin')

    // Check workspace exists and is active
    const { data: ws } = await supabase.from('workspaces').select('is_active').eq('id', data.workspaceId).single()
    if (!ws?.is_active) throw new DatabaseError('Workspace is not active')

    const rawToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = hashToken(rawToken)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    const { data: invite, error } = await supabase.from('workspace_invites').insert({
      workspace_id: data.workspaceId,
      email: data.email,
      role: data.role,
      invited_by: userId,
      token_hash: tokenHash,
      status: 'pending',
      expires_at: expiresAt.toISOString(),
    }).select().single()

    if (error || !invite) throw new DatabaseError('Failed to create invite', error)

    // Return raw token only once — frontend uses it in link
    return { ...invite, token: rawToken }
  }

  async listInvites(userId: string, workspaceId: string) {
    await this.requireRole(userId, workspaceId, 'admin')
    const { data, error } = await supabase.from('workspace_invites').select('id, email, role, status, invited_by, expires_at, created_at').eq('workspace_id', workspaceId).order('created_at', { ascending: false })
    if (error) throw new DatabaseError('Failed to fetch invites', error)
    return data || []
  }

  async acceptInvite(userId: string, userEmail: string, data: AcceptInvite) {
    const tokenHash = hashToken(data.token)

    // Find invite by token hash
    const { data: invite, error: inviteError } = await supabase.from('workspace_invites').select('*').eq('token_hash', tokenHash).eq('status', 'pending').single()
    if (inviteError || !invite) throw new DatabaseError('Invalid or expired invite')

    // ✅ Email match check
    if (invite.email.toLowerCase() !== userEmail.toLowerCase()) {
      throw new DatabaseError('This invitation is for another email address')
    }

    // Check expiration
    if (new Date(invite.expires_at) < new Date()) {
      await supabase.from('workspace_invites').update({ status: 'expired' }).eq('id', invite.id)
      throw new DatabaseError('Invite has expired')
    }

    // Check workspace status
    const { data: ws } = await supabase.from('workspaces').select('is_active').eq('id', invite.workspace_id).single()
    if (!ws?.is_active) throw new DatabaseError('Workspace is no longer active')

    // Check duplicate membership
    const { data: existing } = await supabase.from('workspace_members').select('id').eq('workspace_id', invite.workspace_id).eq('user_id', userId).single()
    if (existing) throw new DatabaseError('Already a member')

    // Add member
    const { error: memberError } = await supabase.from('workspace_members').insert({ workspace_id: invite.workspace_id, user_id: userId, role: invite.role })
    if (memberError) throw new DatabaseError('Failed to join workspace', memberError)

    // Mark invite as accepted
    await supabase.from('workspace_invites').update({ status: 'accepted', accepted_at: new Date().toISOString(), accepted_by: userId }).eq('id', invite.id)

    return { success: true, workspaceId: invite.workspace_id }
  }

  async cancelInvite(userId: string, workspaceId: string, inviteId: string) {
    await this.requireRole(userId, workspaceId, 'admin')
    const { error } = await supabase.from('workspace_invites').update({ status: 'cancelled' }).eq('id', inviteId).eq('workspace_id', workspaceId)
    if (error) throw new DatabaseError('Failed to cancel invite', error)
    return { success: true }
  }

  async resendInvite(userId: string, workspaceId: string, inviteId: string) {
    await this.requireRole(userId, workspaceId, 'admin')

    const { data: invite } = await supabase.from('workspace_invites').select('*').eq('id', inviteId).eq('workspace_id', workspaceId).single()
    if (!invite) throw new DatabaseError('Invite not found')
    if (!['pending', 'expired'].includes(invite.status)) throw new DatabaseError('Cannot resend this invite')

    const rawToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = hashToken(rawToken)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    await supabase.from('workspace_invites').update({ token_hash: tokenHash, status: 'pending', expires_at: expiresAt.toISOString() }).eq('id', inviteId)

    return { ...invite, token: rawToken, status: 'pending', expires_at: expiresAt.toISOString() }
  }

  // ═══════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════

  private async requireMember(userId: string, workspaceId: string) {
    const { data } = await supabase.from('workspace_members').select('role').eq('workspace_id', workspaceId).eq('user_id', userId).single()
    if (!data) throw new DatabaseError('Access denied')
    return data
  }

  private async requireRole(userId: string, workspaceId: string, requiredRole: string) {
    const member = await this.requireMember(userId, workspaceId)
    const hierarchy: Record<string, number> = { owner: 4, admin: 3, member: 2, viewer: 1 }
    if ((hierarchy[member.role] || 0) < (hierarchy[requiredRole] || 0)) throw new DatabaseError('Insufficient permissions')
  }
}