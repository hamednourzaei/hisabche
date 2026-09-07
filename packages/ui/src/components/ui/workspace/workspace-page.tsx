// packages/ui/src/components/ui/workspace/workspace-page.tsx
// ============================================
'use client'

import { SelectField } from '../select-field'
import { useState, useEffect, useCallback, useMemo, memo } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '../../../lib/utils'
import {
  useWorkspaceStore,
  useAuthStore,
  type WorkspaceMember,
  type WorkspaceRole,
} from '@hisabche/store'
import { useRemoveMember, useUpdateMemberRole } from '@hisabche/api'
import { InviteModal } from '../invite-modal'
import { Users, UserPlus, Crown, Shield, User, X } from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════════════════
   WorkspacePage v3 — Memoized · Performance Optimized · i18n Fixed
   ✅ memo · useCallback · useMemo · safeT wrapper
   ═══════════════════════════════════════════════════════════════════════════ */

const roleIconMap: Record<string, React.ReactNode> = {
  owner: <Crown className="size-4 text-[hsl(var(--color-warning))]" />,
  admin: <Shield className="size-4 text-[hsl(var(--color-primary))]" />,
}

const badgeStyles: Record<string, string> = {
  warning:
    'bg-[hsl(var(--color-warning)/0.12)] text-[hsl(var(--color-warning))] border-[hsl(var(--color-warning)/0.2)]',
  default:
    'bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))] border-[hsl(var(--color-primary)/0.2)]',
  secondary:
    'bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-secondary))] border-[hsl(var(--border-default))]',
}

// ─── Member Row Component ──────────────────────────────────────────────────

const MemberRow = memo(function MemberRow({
  member,
  isOwner,
  isAdmin,
  onRoleChange,
  onRemove,
  roleLabel,
  t,
}: {
  member: WorkspaceMember
  isOwner: boolean
  isAdmin: boolean
  onRoleChange: (memberId: string, newRole: WorkspaceRole) => void
  onRemove: (memberId: string) => void
  roleLabel: (role: string) => string
  t: (key: string) => string
}) {
  const bs =
    badgeStyles[
      member.role === 'owner' ? 'warning' : member.role === 'admin' ? 'default' : 'secondary'
    ] ?? badgeStyles.secondary

  return (
    <div className="flex items-center justify-between rounded-xl border border-[hsl(var(--border-default))] p-4">
      <div className="flex items-center gap-3 text-start">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--color-primary)/0.12)] font-bold text-[hsl(var(--color-primary))]">
          {member.fullName?.charAt(0) || '?'}
        </div>
        <div className="min-w-0">
          <p className="truncate font-medium text-[hsl(var(--fg-primary))]">{member.fullName}</p>
          <p className="truncate text-xs text-[hsl(var(--fg-secondary))]">{member.email}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isOwner && member.role !== 'owner' ? (
          <SelectField
            value={member.role}
            onChange={(value) => onRoleChange(member.id, value as WorkspaceRole)}
            options={[
              { value: 'admin', label: t('workspace.admin') },
              { value: 'member', label: t('workspace.employee') },
              { value: 'viewer', label: t('workspace.viewer') },
            ]}
            className={
              'text-xs rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] text-[hsl(var(--fg-primary))] px-2 py-1 cursor-pointer'
            }
          />
        ) : (
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border shrink-0 gap-1',
              bs,
            )}
          >
            {roleIconMap[member.role] || (
              <User className="size-4 text-[hsl(var(--fg-secondary))]" />
            )}
            {roleLabel(member.role)}
          </span>
        )}

        {isAdmin && member.role !== 'owner' && (
          <button
            onClick={() => onRemove(member.id)}
            className="p-1 rounded-lg text-[hsl(var(--fg-tertiary))] hover:bg-[hsl(var(--color-destructive)/0.1)] hover:text-[hsl(var(--color-destructive))] transition-colors"
            aria-label={t('action.remove')}
          >
            <X className="size-4" />
          </button>
        )}
      </div>
    </div>
  )
})
MemberRow.displayName = 'MemberRow'

// ─── Main Component ─────────────────────────────────────────────────────────

export const WorkspacePage = memo(function WorkspacePage() {
  const t = useTranslations()

  const safeT = t

  const { workspaceId, workspaceName, members, currentUserRole, loading, fetchWorkspace } =
    useWorkspaceStore()
  const userId = useAuthStore((s) => s.user?.id)
  const removeMember = useRemoveMember()
  const updateRole = useUpdateMemberRole()
  const [showInvite, setShowInvite] = useState(false)

  useEffect(() => {
    if (userId) fetchWorkspace(userId)
  }, [userId, fetchWorkspace])

  const roleLabel = useCallback(
    (role: string) => {
      switch (role) {
        case 'owner':
          return safeT('workspace.owner')
        case 'admin':
          return safeT('workspace.admin')
        default:
          return safeT('workspace.employee')
      }
    },
    [safeT],
  )

  const isOwner = currentUserRole === 'owner'
  const isAdmin = isOwner || currentUserRole === 'admin'

  const refresh = useCallback(() => {
    if (userId) fetchWorkspace(userId)
  }, [userId, fetchWorkspace])

  const handleRemove = useCallback(
    async (memberId: string) => {
      if (!confirm(safeT('workspace.confirmRemove'))) return
      try {
        await removeMember.mutateAsync({ workspaceId: workspaceId!, memberId })
        refresh()
      } catch {
        alert(safeT('workspace.removeFailed'))
      }
    },
    [workspaceId, removeMember, refresh, safeT],
  )

  const handleRoleChange = useCallback(
    async (memberId: string, newRole: WorkspaceRole) => {
      try {
        await updateRole.mutateAsync({ workspaceId: workspaceId!, memberId, role: newRole })
        refresh()
      } catch {
        alert(safeT('workspace.roleChangeFailed'))
      }
    },
    [workspaceId, updateRole, refresh, safeT],
  )

  const memberRows = useMemo(
    () =>
      members.map((member) => (
        <MemberRow
          key={member.id}
          member={member}
          isOwner={isOwner}
          isAdmin={isAdmin}
          onRoleChange={handleRoleChange}
          onRemove={handleRemove}
          roleLabel={roleLabel}
          t={safeT}
        />
      )),
    [members, isOwner, isAdmin, handleRoleChange, handleRemove, roleLabel, safeT],
  )

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-[hsl(var(--surface-muted))] rounded-lg" />
        <div className="h-40 bg-[hsl(var(--surface-muted))] rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <InviteModal
        open={showInvite}
        onClose={() => setShowInvite(false)}
        workspaceId={workspaceId!}
      />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold sm:text-3xl text-[hsl(var(--fg-primary))]">
            {safeT('nav.coworkers')}
          </h1>
          <p className="text-sm text-[hsl(var(--fg-secondary))]">
            {workspaceName || safeT('workspace.defaultName')}
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowInvite(true)}
            className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold bg-[hsl(var(--color-primary))] text-white shadow-sm shadow-[hsl(var(--color-primary)/0.15)] transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
          >
            <UserPlus className="size-4" />
            {safeT('workspace.inviteMember')}
          </button>
        )}
      </div>

      {/* Members */}
      <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]">
        <div className="p-6">
          <div className="mb-4 flex items-center gap-2">
            <Users className="size-5 text-[hsl(var(--color-primary))]" />
            <h2 className="text-lg font-semibold text-[hsl(var(--fg-primary))]">
              {safeT('workspace.members')} ({members.length})
            </h2>
          </div>

          {members.length === 0 ? (
            <p className="py-8 text-center text-sm text-[hsl(var(--fg-tertiary))]">
              {safeT('workspace.noMembers')}
            </p>
          ) : (
            <div className="space-y-2">{memberRows}</div>
          )}
        </div>
      </div>

      {/* Permissions */}
      <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]">
        <div className="space-y-3 p-6 text-start">
          <h3 className="font-semibold text-[hsl(var(--fg-primary))]">
            {safeT('workspace.permissions')}
          </h3>
          <div className="grid gap-2 text-sm text-[hsl(var(--fg-secondary))]">
            <div className="flex items-center gap-2">
              <Crown className="size-4 text-[hsl(var(--color-warning))]" />
              <span>{safeT('workspace.ownerPerms')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="size-4 text-[hsl(var(--color-primary))]" />
              <span>{safeT('workspace.adminPerms')}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="size-4 text-[hsl(var(--fg-secondary))]" />
              <span>{safeT('workspace.employeePerms')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

WorkspacePage.displayName = 'WorkspacePage'
