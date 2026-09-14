// packages/ui/src/components/ui/permissions/containers/permissions-container.tsx
'use client'

// G3 — the static explainer is replaced by the real matrix.
//
// What was here described four roles (owner/admin/member/viewer) that the
// SERVER does not use — its vocabulary is owner/manager/seller — and said
// module-level restriction "is not implemented yet". Both statements were true
// when written and are no longer: `requireCapability` gates every financial
// route, and Phase E gave grants a home.

import { memo, useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'

import { authorizationText } from '../../../../lib/authorization-message'

import {
  usePermissionMatrix,
  useRoleMembers,
  useSetPermissionCell,
  type AccessLevel,
} from '@hisabche/api'

import { PermissionMatrixView } from '../permission-matrix-view'

/** The server's message, or a generic fallback. Never a swallowed error. */
/**
 * ⚠️ `data.error` IS THE JAVASCRIPT CLASS NAME.
 *
 * The backend's global handler sends `error: err.name`, so this used to render
 * the literal string «ForbiddenError» — in English, in a Persian interface,
 * telling nobody anything. A refused permission is the single most likely
 * failure on THIS screen, so it is the one that has to read properly.
 *
 * `authorizationText` is asked first and answers only for a 403; everything
 * else falls through to the previous behaviour unchanged.
 */
function messageOf(
  error: unknown,
  fallback: string,
  t: (key: string, fallback?: string) => string,
): string {
  const authorization = authorizationText(error, t)
  if (authorization) return authorization

  const response = (error as { response?: { data?: { error?: string } } })?.response
  const raw = response?.data?.error ?? (error as { message?: string })?.message ?? fallback
  // The owner's own access to members and settings cannot be removed — said in
  // words, not as the server's code.
  if (String(raw).includes('PERMISSION_OWNER_LOCKED')) {
    return t(
      'permissions.ownerLocked',
      'مالک همیشه دسترسی مدیریت اعضا و تنظیمات کسب‌وکار را حفظ می‌کند؛ این سطح برای مالک قابل کاهش نیست.',
    )
  }
  if (String(raw).includes('PERMISSION_MIGRATION_REQUIRED')) {
    return t(
      'permissions.migrationRequired',
      'ویرایش نقش‌های اصلی پس از اجرای مهاجرت پایگاه‌داده فعال می‌شود.',
    )
  }
  return raw
}

export const PermissionsContainer = memo(function PermissionsContainer() {
  const tOriginal = useTranslations()
  const t = useCallback(
    (key: string, fallback?: string): string => {
      const v = tOriginal(key as Parameters<typeof tOriginal>[0])
      return v && v !== key ? v : (fallback ?? key)
    },
    [tOriginal],
  )

  const { data: matrix, isLoading, error: loadError } = usePermissionMatrix()
  const setCell = useSetPermissionCell()

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null)
  const { data: roleMembers = [] } = useRoleMembers(selectedRoleId ?? undefined)

  const [saveError, setSaveError] = useState<string | null>(null)

  const handleSetCell = useCallback(
    (input: { roleId: string; moduleKey: string; level: AccessLevel }) => {
      setSaveError(null)
      setCell.mutate(input, {
        // The server refuses a non-owner with PERMISSION_MATRIX_FORBIDDEN and
        // an un-migrated database with PERMISSION_CATALOGUE_INCOMPLETE. Both
        // are shown: a dropdown that snaps back with no explanation is how
        // someone concludes the screen is broken.
        onError: (error) =>
          setSaveError(messageOf(error, t('common.saveError', 'ذخیره ناموفق بود'), t)),
      })
    },
    [setCell, t],
  )

  const toggleRole = useCallback(
    (roleId: string) => setSelectedRoleId((current) => (current === roleId ? null : roleId)),
    [],
  )

  return (
    <PermissionMatrixView
      t={t}
      modules={matrix?.modules ?? []}
      roles={matrix?.roles ?? []}
      cells={matrix?.cells ?? []}
      isLoading={isLoading}
      isSaving={setCell.isPending}
      error={saveError ?? (loadError ? messageOf(loadError, '', t) : null)}
      onSetCell={handleSetCell}
      onSelectRole={toggleRole}
      selectedRoleId={selectedRoleId}
      roleMembers={roleMembers}
    />
  )
})

PermissionsContainer.displayName = 'PermissionsContainer'
