// ============================================
// backend/src/services/workspace.service.ts
// ============================================
import { supabase } from '../db'
import { CreateWorkspace, UpdateWorkspace, UpdateMemberRole, CreateInvite, AcceptInvite } from '@hisabche/validation'
import { DatabaseError } from '../errors/database.error'
import crypto from 'crypto'

function hashToken(token: string): string { return crypto.createHash('sha256').update(token).digest('hex') }

export class WorkspaceService {
  async createWorkspace(userId: string, data: CreateWorkspace) {
    const slug = data.slug || data.name.toLowerCase().replace(/\s+/g, '-')
    const { data: workspace, error } = await supabase.from('workspaces').insert({ name: data.name, slug, description: data.description || null, logo_url: data.logoUrl || null, owner_id: userId }).select().single()
    if (error || !workspace) throw new DatabaseError('Failed to create workspace', error)
    await supabase.from('workspace_members').insert({ workspace_id: workspace.id, user_id: userId, role: 'owner' })
    return workspace
  }
  async getMyWorkspaces(userId: string) {
    const { data: m, error } = await supabase.from('workspace_members').select('workspace_id, role').eq('user_id', userId)
    if (error || !m?.length) return []
    const { data: ws } = await supabase.from('workspaces').select('*').in('id', m.map(x => x.workspace_id))
    return (ws || []).map(w => ({ ...w, myRole: m.find(x => x.workspace_id === w.id)?.role || 'member' }))
  }
  async getWorkspace(userId: string, workspaceId: string) {
    const { data: member } = await supabase.from('workspace_members').select('role').eq('workspace_id', workspaceId).eq('user_id', userId).single()
    if (!member) throw new DatabaseError('Access denied')
    const { data: ws } = await supabase.from('workspaces').select('*').eq('id', workspaceId).single()
    if (!ws) throw new DatabaseError('Workspace not found')
    return { ...ws, myRole: member.role }
  }
  async updateWorkspace(userId: string, workspaceId: string, data: UpdateWorkspace) {
    await this.requireRole(userId, workspaceId, 'admin')
    const u: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (data.name !== undefined) u.name = data.name
    if (data.description !== undefined) u.description = data.description
    if (data.logoUrl !== undefined) u.logo_url = data.logoUrl
    const { data: ws } = await supabase.from('workspaces').update(u).eq('id', workspaceId).select().single()
    if (!ws) throw new DatabaseError('Failed to update workspace')
    return ws
  }
  async listMembers(userId: string, workspaceId: string) {
    await this.requireMember(userId, workspaceId)
    const { data } = await supabase.from('workspace_members').select('id, user_id, role, joined_at').eq('workspace_id', workspaceId)
    return data || []
  }
  async updateMemberRole(userId: string, workspaceId: string, data: UpdateMemberRole) {
    await this.requireRole(userId, workspaceId, 'owner')
    await supabase.from('workspace_members').update({ role: data.role }).eq('id', data.memberId).eq('workspace_id', workspaceId)
    return { success: true }
  }
  async removeMember(userId: string, workspaceId: string, memberId: string) {
    await this.requireRole(userId, workspaceId, 'admin')
    const { data: m } = await supabase.from('workspace_members').select('role, user_id').eq('id', memberId).single()
    if (!m) throw new DatabaseError('Member not found')
    if (m.role === 'owner' || m.user_id === userId) throw new DatabaseError('Cannot remove')
    await supabase.from('workspace_members').delete().eq('id', memberId)
    return { success: true }
  }
  async leaveWorkspace(userId: string, workspaceId: string) {
    const { data: m } = await supabase.from('workspace_members').select('role, id').eq('workspace_id', workspaceId).eq('user_id', userId).single()
    if (!m || m.role === 'owner') throw new DatabaseError('Cannot leave')
    await supabase.from('workspace_members').delete().eq('id', m.id)
    return { success: true }
  }

  // ═══ INVITES ═══
  async createInvite(userId: string, data: CreateInvite) {
    await this.requireRole(userId, data.workspaceId, 'admin')
    const { data: ws } = await supabase.from('workspaces').select('is_active').eq('id', data.workspaceId).single()
    if (!ws?.is_active) throw new DatabaseError('Workspace is not active')

    const rawToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = hashToken(rawToken)
    const expiresAt = new Date(); expiresAt.setDate(expiresAt.getDate() + 7)

    console.log('[createInvite] Inserting with token_hash:', tokenHash)
    const { data: invite, error } = await supabase.from('workspace_invites').insert({
      workspace_id: data.workspaceId, email: data.email, role: data.role,
      invited_by: userId, token: tokenHash, token_hash: tokenHash,
      status: 'pending', expires_at: expiresAt.toISOString(),
    }).select().single()
    console.log('[createInvite] Result:', invite, 'Error:', error)

    if (error || !invite) throw new DatabaseError('Failed to create invite', error)
    const result = { ...invite, token: rawToken }
    console.log('[createInvite] Returning:', result)
    return result
  }

  async listInvites(userId: string, workspaceId: string) {
    await this.requireRole(userId, workspaceId, 'admin')
    const { data } = await supabase.from('workspace_invites').select('id, email, role, status, invited_by, expires_at, created_at').eq('workspace_id', workspaceId).order('created_at', { ascending: false })
    return data || []
  }
  async acceptInvite(userId: string, userEmail: string, data: AcceptInvite) {
    const th = hashToken(data.token)
    const { data: invite } = await supabase.from('workspace_invites').select('*').eq('token_hash', th).eq('status', 'pending').single()
    if (!invite) throw new DatabaseError('Invalid or expired invite')
    if (invite.email.toLowerCase() !== userEmail.toLowerCase()) throw new DatabaseError('Wrong email')
    if (new Date(invite.expires_at) < new Date()) { await supabase.from('workspace_invites').update({ status: 'expired' }).eq('id', invite.id); throw new DatabaseError('Expired') }
    const { data: ws } = await supabase.from('workspaces').select('is_active').eq('id', invite.workspace_id).single()
    if (!ws?.is_active) throw new DatabaseError('Workspace inactive')
    const { data: ex } = await supabase.from('workspace_members').select('id').eq('workspace_id', invite.workspace_id).eq('user_id', userId).single()
    if (ex) throw new DatabaseError('Already member')
    await supabase.from('workspace_members').insert({ workspace_id: invite.workspace_id, user_id: userId, role: invite.role })
    await supabase.from('workspace_invites').update({ status: 'accepted', accepted_at: new Date().toISOString(), accepted_by: userId }).eq('id', invite.id)
    return { success: true, workspaceId: invite.workspace_id }
  }
  async cancelInvite(userId: string, workspaceId: string, inviteId: string) {
    await this.requireRole(userId, workspaceId, 'admin')
    await supabase.from('workspace_invites').update({ status: 'cancelled' }).eq('id', inviteId)
    return { success: true }
  }
  async resendInvite(userId: string, workspaceId: string, inviteId: string) {
    await this.requireRole(userId, workspaceId, 'admin')
    const { data: inv } = await supabase.from('workspace_invites').select('*').eq('id', inviteId).single()
    if (!inv || !['pending', 'expired'].includes(inv.status)) throw new DatabaseError('Cannot resend')
    const rawToken = crypto.randomBytes(32).toString('hex')
    const th = hashToken(rawToken)
    const exp = new Date(); exp.setDate(exp.getDate() + 7)
    await supabase.from('workspace_invites').update({ token: th, token_hash: th, status: 'pending', expires_at: exp.toISOString() }).eq('id', inviteId)
    return { ...inv, token: rawToken, status: 'pending', expires_at: exp.toISOString() }
  }

  private async requireMember(userId: string, workspaceId: string) {
    const { data } = await supabase.from('workspace_members').select('role').eq('workspace_id', workspaceId).eq('user_id', userId).single()
    if (!data) throw new DatabaseError('Access denied')
    return data
  }
  private async requireRole(userId: string, workspaceId: string, requiredRole: string) {
    const m = await this.requireMember(userId, workspaceId)
    const h: Record<string, number> = { owner: 4, admin: 3, member: 2, viewer: 1 }
    if ((h[m.role] || 0) < (h[requiredRole] || 0)) throw new DatabaseError('Insufficient permissions')
  }
}