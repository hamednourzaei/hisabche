'use client'

// ============================================
// packages/ui/src/components/ui/permissions/permission-matrix-view.tsx
//
// G3 — modules down the side, roles across the top, an access level in each
// cell. Replaces the static explainer that described a role vocabulary
// (owner/admin/member/viewer) the server does not use.
//
// ---------------------------------------------------------------------------
// THE ONE THING THIS SCREEN MUST NOT DO
//
// Show a control that does nothing.
//
// Capability resolution is additive (Phase E): `workspace_members.role` decides
// through the enforced static table, and grants can only ADD. So for owner,
// manager and seller the cells are REAL but LOCKED — unticking `ledger.post`
// for a manager would change no behaviour whatsoever, and a checkbox that
// silently fails is worse than no checkbox.
//
// Locked cells are drawn differently and say why on hover. Everything else is
// live: changing it writes `role_permissions` and takes effect on the next
// request.
//
// ---------------------------------------------------------------------------
// RTL
//
// The module column is `text-start`, not `text-left`, and the table scrolls in
// its own container so a wide role list never makes the page scroll sideways.
// ============================================

import { SelectField } from '../select-field'
import { memo, useCallback, useMemo, useState } from 'react'
import { Info, Lock, Shield, Users } from 'lucide-react'

import { cn } from '../../../lib/utils'

export type AccessLevel = 'none' | 'read' | 'write' | 'full'

export interface MatrixModule {
  key: string
  label: string
  levels: AccessLevel[]
}

export interface MatrixRole {
  id: string
  code: string
  name: string
  description: string | null
  isSystem: boolean
  isEnforcedBase: boolean
  workspaceId: string | null
}

export interface MatrixCell {
  roleId: string
  moduleKey: string
  baseLevel: AccessLevel
  grantedLevel: AccessLevel
  effectiveLevel: AccessLevel
  editable: boolean
}

export interface RoleMember {
  userId: string
  name: string | null
  position: string | null
}

interface PermissionMatrixViewProps {
  t: (key: string, fallback?: string) => string
  modules: MatrixModule[]
  roles: MatrixRole[]
  cells: MatrixCell[]
  isLoading?: boolean
  isSaving?: boolean
  error?: string | null
  onSetCell: (input: { roleId: string; moduleKey: string; level: AccessLevel }) => void
  /** H5 will use this to list who holds a role. */
  onSelectRole?: (roleId: string) => void
  selectedRoleId?: string | null
  roleMembers?: RoleMember[]
}

const LEVEL_LABEL: Record<AccessLevel, string> = {
  none: 'بدون دسترسی',
  read: 'مشاهده',
  write: 'مشاهده و ثبت',
  full: 'کامل',
}

const LEVEL_STYLE: Record<AccessLevel, string> = {
  none: 'bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-tertiary))]',
  read: 'bg-[hsl(var(--color-primary)/0.10)] text-[hsl(var(--color-primary))]',
  write: 'bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))]',
  full: 'bg-[hsl(var(--color-warning)/0.14)] text-[hsl(var(--color-warning))]',
}

export const PermissionMatrixView = memo(function PermissionMatrixView({
  t,
  modules,
  roles,
  cells,
  isLoading = false,
  isSaving = false,
  error,
  onSetCell,
  onSelectRole,
  selectedRoleId,
  roleMembers = [],
}: PermissionMatrixViewProps) {
  // Rendering 96 cells means 96 lookups per render; a map makes each one O(1).
  const cellByKey = useMemo(() => {
    const map = new Map<string, MatrixCell>()
    for (const cell of cells) map.set(`${cell.roleId}:${cell.moduleKey}`, cell)
    return map
  }, [cells])

  const [showLockedNote, setShowLockedNote] = useState(false)

  const handleChange = useCallback(
    (roleId: string, moduleKey: string, level: AccessLevel) => {
      onSetCell({ roleId, moduleKey, level })
    },
    [onSetCell],
  )

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-xl bg-[hsl(var(--surface-muted))]" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Shield className="mt-0.5 size-6 shrink-0 text-[hsl(var(--color-primary))]" aria-hidden />
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--fg-primary))]">
            {t('permissions.title', 'دسترسی‌ها')}
          </h1>
          <p className="mt-1 text-sm text-[hsl(var(--fg-secondary))]">
            {t(
              'permissions.subtitle',
              'هر ماژول در برابر هر نقش. تغییر هر خانه بلافاصله روی دسترسی واقعی اثر می‌گذارد.',
            )}
          </p>
        </div>
      </div>

      {/*
        The honest caveat, on the screen rather than buried in a comment. A user
        who ticks a locked cell and sees nothing happen would rightly conclude
        the whole screen is broken.
      */}
      <div className="rounded-2xl border border-[hsl(var(--color-warning)/0.35)] bg-[hsl(var(--color-warning)/0.06)] p-4">
        <button
          type="button"
          onClick={() => setShowLockedNote((v) => !v)}
          className="flex w-full items-center gap-2 text-start text-sm font-semibold text-[hsl(var(--fg-primary))]"
          aria-expanded={showLockedNote}
        >
          <Info className="size-4 shrink-0 text-[hsl(var(--color-warning))]" aria-hidden />
          {t('permissions.additiveTitle', 'نقش‌های پایه قابل ویرایش نیستند — چرا؟')}
        </button>

        {showLockedNote && (
          <p className="mt-2 text-sm leading-6 text-[hsl(var(--fg-secondary))]">
            {t(
              'permissions.additiveBody',
              'دسترسی «مالک»، «مدیر» و «فروشنده» از جدول ثابتی می‌آید که سرور واقعاً آن را اعمال می‌کند. پروفایل‌ها فقط می‌توانند دسترسی اضافه کنند، نه کم. اگر خانه‌ای قفل است، برداشتن تیکش هیچ تغییری نمی‌داد — و کنترلی که کاری نمی‌کند بدتر از نبودنش است.',
            )}
          </p>
        )}
      </div>

      {error && (
        <p className="text-sm text-[hsl(var(--color-destructive))]" role="alert">
          {error}
        </p>
      )}

      {/* Its own scroll container: a wide role list must never make the PAGE
          scroll sideways. */}
      <div className="overflow-x-auto rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[hsl(var(--border-default))]">
              <th className="p-3 text-start font-semibold text-[hsl(var(--fg-primary))]">
                {t('permissions.module', 'ماژول')}
              </th>
              {roles.map((role) => (
                <th key={role.id} className="p-3 text-start font-semibold">
                  <button
                    type="button"
                    onClick={() => onSelectRole?.(role.id)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-md px-1 py-0.5 transition-colors hover:bg-[hsl(var(--surface-muted))]',
                      selectedRoleId === role.id && 'bg-[hsl(var(--surface-muted))]',
                    )}
                    title={role.description ?? undefined}
                  >
                    <span className="text-[hsl(var(--fg-primary))]">{role.name}</span>
                    {role.isEnforcedBase && (
                      <Lock className="size-3 text-[hsl(var(--fg-tertiary))]" aria-hidden />
                    )}
                  </button>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {modules.map((module) => (
              <tr
                key={module.key}
                className="border-b border-[hsl(var(--border-default))] last:border-0"
              >
                <td className="p-3 text-start font-medium text-[hsl(var(--fg-primary))]">
                  {t(`permissions.module.${module.key}`, module.label)}
                </td>

                {roles.map((role) => {
                  const cell = cellByKey.get(`${role.id}:${module.key}`)
                  if (!cell) return <td key={role.id} className="p-3" />

                  // Locked when the role is one the static table decides, or
                  // when the base already covers everything this module offers.
                  const locked = role.isEnforcedBase || !cell.editable

                  return (
                    <td key={role.id} className="p-3">
                      {locked ? (
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
                            LEVEL_STYLE[cell.effectiveLevel],
                          )}
                          title={t(
                            'permissions.lockedCell',
                            'از جدول دسترسی اعمال‌شده می‌آید و اینجا قابل تغییر نیست.',
                          )}
                        >
                          <Lock className="size-3" aria-hidden />
                          {t(
                            `permissions.level.${cell.effectiveLevel}`,
                            LEVEL_LABEL[cell.effectiveLevel],
                          )}
                        </span>
                      ) : (
                        <SelectField
                          value={cell.grantedLevel}
                          onChange={(value) =>
                            handleChange(role.id, module.key, value as AccessLevel)
                          }
                          options={[
                            ...module.levels.map((level) => ({
                              value: level,
                              label: t(`permissions.level.${level}`, LEVEL_LABEL[level]),
                            })),
                          ]}
                          className={cn(
                            'rounded-full border-0 px-2.5 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary)/0.4)] disabled:opacity-50',
                            LEVEL_STYLE[cell.grantedLevel],
                          )}
                          disabled={isSaving}
                        />
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* H5's drill-down: who actually holds the selected role. */}
      {selectedRoleId && (
        <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[hsl(var(--fg-primary))]">
            <Users className="size-4" aria-hidden />
            {t('permissions.roleMembers', 'کسانی که این نقش را دارند')}
          </h2>

          {roleMembers.length === 0 ? (
            <p className="text-sm text-[hsl(var(--fg-tertiary))]">
              {t('permissions.noRoleMembers', 'هیچ‌کس این نقش را ندارد.')}
            </p>
          ) : (
            <ul className="space-y-1">
              {roleMembers.map((member) => (
                <li key={member.userId} className="flex items-center gap-2 text-sm">
                  <span className="text-[hsl(var(--fg-primary))]">
                    {/*
                      A member with no employee record still appears, with their
                      id — dropping them would make the list quietly wrong about
                      who can do what.
                    */}
                    {member.name || member.userId.slice(0, 8)}
                  </span>
                  {member.position && (
                    <span className="text-xs text-[hsl(var(--fg-tertiary))]">
                      {member.position}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
})
