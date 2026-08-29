'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from '@/components/ui'

import {
  canPromoteToOwner,
  sortMembers,
  useRemoveMember,
  useUpdateMemberRole,
  useWorkspaceMembers,
  type AdminMember,
  type MemberRole,
} from '@/hooks/use-admin-members'
import { EmptyState, ErrorState, StatusDot } from '@/components/admin-shell/admin-ui'
import { cn } from '@/lib/utils'
import { RemoveMemberDialog } from './remove-member-dialog'

const ROLES: MemberRole[] = ['owner', 'manager', 'seller']

/**
 * The member rows of ONE expanded workspace.
 *
 * These are visually CHILDREN of the workspace row, not peers: they sit inside
 * the parent's expanded region, indented with a border on the inline-start
 * edge, on a recessed background. The indent uses `ms-*`/`border-s` (logical
 * properties) so the hierarchy reads correctly in RTL — a left border would
 * end up on the wrong side in Persian and the nesting would stop being legible.
 */
export function MemberList({
  workspaceId,
  workspaceName,
  expanded,
  regionId,
}: {
  workspaceId: string
  workspaceName: string
  /** Drives the lazy fetch. Members load on first expand, never before. */
  expanded: boolean
  regionId: string
}) {
  const t = useTranslations()
  const { data, isLoading, isError, refetch } = useWorkspaceMembers(workspaceId, expanded)
  const updateRole = useUpdateMemberRole(workspaceId)
  const removeMember = useRemoveMember(workspaceId)

  const [pending, setPending] = useState<AdminMember | null>(null)

  if (isLoading) {
    return (
      <div id={regionId} className="space-y-2 py-3">
        {/* Three rows, matching the usual member count, so expanding does not
            jump the page height when the real rows arrive. */}
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div id={regionId} className="p-3">
        <ErrorState message={t('admin.error.loadMembers')} onRetry={() => void refetch()} />
      </div>
    )
  }

  const members = sortMembers(data ?? [])

  if (members.length === 0) {
    return (
      <div id={regionId} className="p-3">
        <EmptyState title={t('admin.empty.noMembers')} />
      </div>
    )
  }

  return (
    <div id={regionId} className="py-2">
      <ul className="ms-4 space-y-2 border-s-2 border-blue-500/30 ps-4 sm:ms-8 sm:ps-6">
        {members.map((member) => {
          const isOwner = member.role === 'owner'
          const busy =
            (updateRole.isPending && updateRole.variables?.membershipId === member.id) ||
            (removeMember.isPending && removeMember.variables === member.id)

          return (
            <li
              key={member.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              {/* Identity. `min-w-0` + `truncate` so a long email cannot push
                  the actions off-screen on a narrow viewport. */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-medium">
                    {member.name ?? t('admin.member.unknown')}
                  </span>
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
                      isOwner
                        ? 'border-violet-500/40 bg-violet-500/15 text-violet-400'
                        : 'border-blue-500/40 bg-blue-500/15 text-blue-400',
                    )}
                  >
                    {t(`admin.member.role${capitalise(member.role)}`)}
                  </span>
                  {/*
                    `status` is READ-ONLY here on purpose. `has_access` and
                    `suspended_at` have no write endpoint — see the capability
                    contract's FUTURE section — so this is a badge, never a
                    toggle. A switch that silently did nothing would be worse
                    than no switch.
                  */}
                  {member.status !== 'active' && (
                    <span className="inline-flex items-center gap-2 rounded-full border border-warning/40 bg-warning/10 px-2.5 py-0.5 text-xs font-medium text-warning">
                      <StatusDot tone="attention" />
                      {member.status === 'suspended'
                        ? t('admin.member.statusSuspended')
                        : t('admin.member.statusNoAccess')}
                    </span>
                  )}
                </div>
                <div className="mt-1 truncate text-sm text-muted-foreground">
                  {member.email ?? t('admin.member.noProfile')}
                </div>
                {member.joinedAt && (
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {t('admin.member.joined')}:{' '}
                    <time dateTime={member.joinedAt} suppressHydrationWarning>
                      {new Date(member.joinedAt).toLocaleDateString()}
                    </time>
                  </div>
                )}
              </div>

              {/* Actions. `shrink-0` keeps them intact; on mobile they wrap to
                  their own row rather than being clipped. */}
              <div className="flex shrink-0 items-center gap-2">
                <Select
                  value={member.role}
                  disabled={busy}
                  onValueChange={(role) => {
                    if (role === member.role) return
                    updateRole.mutate({ membershipId: member.id, role: role as MemberRole })
                  }}
                >
                  <SelectTrigger
                    className="h-11 w-[8.5rem] rounded-xl"
                    aria-label={`${t('admin.member.editRole')} — ${member.name ?? member.email ?? member.userId}`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((role) => (
                      <SelectItem
                        key={role}
                        value={role}
                        // Mirrors the server rule so the UI does not invite a
                        // click it knows will be refused. The server still
                        // rejects a second owner, and the unique index rejects
                        // it again — this is the third layer, not the only one.
                        disabled={role === 'owner' && !canPromoteToOwner(members, member.id)}
                      >
                        {t(`admin.member.role${capitalise(role)}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {isOwner ? (
                  // Not a disabled Remove button: the owner is not "temporarily
                  // unremovable", the operation does not apply. Removing an
                  // owner is an ownership transfer, which this screen does not
                  // do.
                  <span
                    className="px-2 text-xs text-muted-foreground"
                    title={t('admin.member.ownerProtected')}
                  >
                    {t('admin.member.ownerProtected')}
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-11 rounded-xl"
                    disabled={busy}
                    onClick={() => setPending(member)}
                  >
                    {t('admin.member.remove')}
                  </Button>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      {(updateRole.isError || removeMember.isError) && (
        <p role="alert" className="mt-2 px-4 text-sm text-destructive">
          {updateRole.isError ? t('admin.error.updateRole') : t('admin.error.removeMember')}
        </p>
      )}

      <RemoveMemberDialog
        member={pending}
        workspaceName={workspaceName}
        pending={removeMember.isPending}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (!pending) return
          removeMember.mutate(pending.id, {
            // Closed only on success: a failed removal must leave the member
            // visible and the dialog answerable, not silently dismissed.
            onSuccess: () => setPending(null),
          })
        }}
      />
    </div>
  )
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
