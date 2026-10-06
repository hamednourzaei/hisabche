'use client'

// ============================================
// packages/ui/src/components/ui/permissions/permission-matrix-view.tsx
//
// «دسترسی‌ها» — every part of the product down the side, every role across the
// top, and ONE question in each cell: what may a holder of this role do there?
//
//   نمی‌بیند                   the part is not in their menu at all
//   فقط می‌بیند                they can open it and read
//   می‌بیند و تغییر می‌دهد     they can also add and edit
//   کامل                       …and delete / configure, where the part has that
//
// ROLES
//   مالک / مدیر / فروشنده   the three every business has. Editable per business
//                            (the owner's own lock is refused on save, with why).
//   a role you made          «انباردار», «حسابدار شعبه» … Its holder gets EXACTLY
//                            what its column says — it replaces the base role, it
//                            is not added on top. It is what a new employee is given.
//   a shared template        حسابدار، صندوق‌دار … offered only as a starting point
//                            for a new role; it is the platform's row and is not
//                            a column here.
//
// ⚠️ THE ONE THING THIS SCREEN MUST NOT DO: show a control that does nothing.
// It used to — a profile's column said «takes effect on the next request» and
// the server never read it. Every cell here is what `requireCapability` enforces.
//
// RTL: the module column is `text-start`, and the table scrolls in its own
// container so a wide role list never makes the page scroll sideways.
// ============================================

import { memo, useMemo, useState } from 'react'
import { EyeOff, Eye, Lock, Pencil, Plus, Shield, ShieldCheck, Trash2, Users } from 'lucide-react'

import { cn } from '../../../lib/utils'
import { SelectField } from '../select-field'

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
  /** A role this business made. */
  isCustom?: boolean | undefined
  /** A shared starting point — never a column. */
  isTemplate?: boolean | undefined
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
  onCreateRole?:
    ((input: { name: string; templateRoleId?: string | undefined }) => void) | undefined
  onDeleteRole?: ((roleId: string) => void) | undefined
  isCreatingRole?: boolean | undefined
  onSelectRole?: (roleId: string) => void
  selectedRoleId?: string | null
  roleMembers?: RoleMember[]
}

const LEVEL_LABEL: Record<AccessLevel, string> = {
  none: 'نمی‌بیند',
  read: 'فقط می‌بیند',
  write: 'می‌بیند و تغییر می‌دهد',
  full: 'کامل',
}

const LEVEL_STYLE: Record<AccessLevel, string> = {
  none: 'bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-tertiary))]',
  read: 'bg-[hsl(var(--color-primary)/0.10)] text-[hsl(var(--color-primary))]',
  write: 'bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))]',
  full: 'bg-[hsl(var(--color-warning)/0.14)] text-[hsl(var(--color-warning))]',
}

const LEVEL_ICON = { none: EyeOff, read: Eye, write: Pencil, full: ShieldCheck } as const

const FIELD =
  'min-h-10 rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-3 text-sm text-[hsl(var(--fg-primary))] outline-none focus:border-[hsl(var(--color-primary))]'

/** Base roles in the order a person reads them; the business's own roles after. */
const BASE_ORDER = ['owner', 'manager', 'seller']

export const PermissionMatrixView = memo(function PermissionMatrixView({
  t,
  modules,
  roles,
  cells,
  isLoading = false,
  isSaving = false,
  error,
  onSetCell,
  onCreateRole,
  onDeleteRole,
  isCreatingRole = false,
  onSelectRole,
  selectedRoleId,
  roleMembers = [],
}: PermissionMatrixViewProps) {
  // Rendering ~100 cells means ~100 lookups per render; a map makes each O(1).
  const cellByKey = useMemo(() => {
    const map = new Map<string, MatrixCell>()
    for (const cell of cells) map.set(`${cell.roleId}:${cell.moduleKey}`, cell)
    return map
  }, [cells])

  // Columns: the three base roles, then this business's own. Templates are not
  // columns — they cannot be changed here and nobody holds them.
  const columns = useMemo(() => {
    const base = roles
      .filter((role) => role.isEnforcedBase)
      .sort((a, b) => BASE_ORDER.indexOf(a.code) - BASE_ORDER.indexOf(b.code))
    const own = roles.filter((role) => role.isCustom)
    return [...base, ...own]
  }, [roles])
  const templates = useMemo(() => roles.filter((role) => role.isTemplate), [roles])

  const [name, setName] = useState('')
  const [templateId, setTemplateId] = useState('')

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-xl bg-[hsl(var(--surface-muted))]" />
        ))}
      </div>
    )
  }

  const roleName = (role: MatrixRole) =>
    role.isEnforcedBase ? t(`permissions.baseRole.${role.code}`, role.name) : role.name

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Shield className="mt-0.5 size-6 shrink-0 text-[hsl(var(--color-primary))]" aria-hidden />
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--fg-primary))]">
            {t('permissions.title', 'نقش‌ها و دسترسی‌ها')}
          </h1>
          <p className="mt-1 text-sm text-[hsl(var(--fg-secondary))]">
            {t(
              'permissions.subtitle',
              'برای هر نقش مشخص کنید هر بخش را نبیند، فقط ببیند، یا ببیند و تغییر دهد. تغییر هر خانه بلافاصله اعمال می‌شود.',
            )}
          </p>
        </div>
      </div>

      {/* What the four choices mean — said once, above the table. */}
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" data-permission-legend="">
        {(['none', 'read', 'write', 'full'] as const).map((level) => {
          const Icon = LEVEL_ICON[level]
          return (
            <li
              key={level}
              className="flex items-start gap-2 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-3"
            >
              <span
                className={cn(
                  'inline-flex size-7 shrink-0 items-center justify-center rounded-full',
                  LEVEL_STYLE[level],
                )}
              >
                <Icon className="size-3.5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[hsl(var(--fg-primary))]">
                  {t(`permissions.level.${level}`, LEVEL_LABEL[level])}
                </span>
                <span className="block text-xs text-[hsl(var(--fg-secondary))]">
                  {t(`permissions.levelHint.${level}`, '')}
                </span>
              </span>
            </li>
          )
        })}
      </ul>

      {/* A role of your own. */}
      {onCreateRole ? (
        <form
          className="space-y-3 rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4"
          data-new-role=""
          onSubmit={(event) => {
            event.preventDefault()
            const trimmed = name.trim()
            if (!trimmed) return
            onCreateRole({ name: trimmed, ...(templateId ? { templateRoleId: templateId } : {}) })
            setName('')
            setTemplateId('')
          }}
        >
          <div>
            <h2 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
              {t('permissions.newRole', 'نقش جدید')}
            </h2>
            <p className="mt-1 text-xs text-[hsl(var(--fg-secondary))]">
              {t(
                'permissions.newRoleHint',
                'نقشی برای کسب‌وکار خودتان بسازید — مثلاً «انباردار». کسی که این نقش را بگیرد دقیقاً همان چیزهایی را می‌بیند که در ستون آن تعیین می‌کنید.',
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs text-[hsl(var(--fg-secondary))]">
              {t('permissions.roleName', 'نام نقش')}
              <input
                name="name"
                value={name}
                maxLength={60}
                onChange={(event) => setName(event.target.value)}
                className={FIELD}
              />
            </label>
            <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs text-[hsl(var(--fg-secondary))]">
              {t('permissions.startFrom', 'شروع از')}
              <SelectField
                value={templateId}
                onChange={setTemplateId}
                data-field="templateRoleId"
                options={[
                  { value: '', label: t('permissions.startEmpty', 'خالی (هیچ بخشی را نمی‌بیند)') },
                  ...templates.map((role) => ({ value: role.id, label: role.name })),
                  ...columns
                    .filter((role) => role.isCustom)
                    .map((role) => ({ value: role.id, label: role.name })),
                ]}
                className={FIELD}
              />
            </label>
            <button
              type="submit"
              disabled={isCreatingRole || name.trim().length === 0}
              className="inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-full bg-[hsl(var(--color-primary))] px-5 text-sm font-bold text-[hsl(var(--color-primary-fg))] disabled:opacity-50"
            >
              <Plus className="size-4" aria-hidden />
              {t('permissions.createRole', 'ساخت نقش')}
            </button>
          </div>
        </form>
      ) : null}

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
                {t('permissions.part', 'بخش')}
              </th>
              {columns.map((role) => (
                <th key={role.id} className="p-3 text-start font-semibold">
                  <span className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onSelectRole?.(role.id)}
                      className={cn(
                        'flex items-center gap-1.5 whitespace-nowrap rounded-md px-1 py-0.5 transition-colors hover:bg-[hsl(var(--surface-muted))]',
                        selectedRoleId === role.id && 'bg-[hsl(var(--surface-muted))]',
                      )}
                      title={role.description ?? undefined}
                    >
                      <span className="text-[hsl(var(--fg-primary))]">{roleName(role)}</span>
                    </button>
                    {role.isCustom && onDeleteRole ? (
                      <button
                        type="button"
                        onClick={() => onDeleteRole(role.id)}
                        disabled={isSaving}
                        aria-label={`${t('permissions.deleteRole', 'حذف نقش')}: ${role.name}`}
                        title={t('permissions.deleteRole', 'حذف نقش')}
                        className="inline-flex size-7 items-center justify-center rounded-md text-[hsl(var(--fg-tertiary))] hover:bg-[hsl(var(--color-destructive)/0.1)] hover:text-[hsl(var(--color-destructive))] disabled:opacity-50"
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </button>
                    ) : null}
                  </span>
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

                {columns.map((role) => {
                  const cell = cellByKey.get(`${role.id}:${module.key}`)
                  if (!cell) return <td key={role.id} className="p-3" />

                  // A base role's cell is what is enforced for it in this
                  // business; a role of your own is exactly its grant.
                  const locked = !cell.editable
                  const current = role.isEnforcedBase ? cell.effectiveLevel : cell.grantedLevel

                  return (
                    <td key={role.id} className="p-3">
                      {locked ? (
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium',
                            LEVEL_STYLE[cell.effectiveLevel],
                          )}
                          title={t('permissions.lockedCell', 'این خانه قابل تغییر نیست.')}
                        >
                          <Lock className="size-3" aria-hidden />
                          {t(
                            `permissions.level.${cell.effectiveLevel}`,
                            LEVEL_LABEL[cell.effectiveLevel],
                          )}
                        </span>
                      ) : (
                        <SelectField
                          value={current}
                          onChange={(value) =>
                            onSetCell({
                              roleId: role.id,
                              moduleKey: module.key,
                              level: value as AccessLevel,
                            })
                          }
                          data-field={`${role.id}:${module.key}`}
                          options={module.levels.map((level) => ({
                            value: level,
                            label: t(`permissions.level.${level}`, LEVEL_LABEL[level]),
                          }))}
                          className={cn(
                            'whitespace-nowrap rounded-full border-0 px-2.5 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary)/0.4)]',
                            LEVEL_STYLE[current],
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

      {/* Who actually holds the selected role. */}
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
                    {/* A member with no employee record still appears, with their
                        id — dropping them would make the list quietly wrong about
                        who can do what. */}
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
