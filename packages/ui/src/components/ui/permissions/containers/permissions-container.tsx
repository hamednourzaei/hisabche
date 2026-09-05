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

import {
  usePermissionMatrix,
  useRoleMembers,
  useSetPermissionCell,
  type AccessLevel,
} from '@hisabche/api'

import { PermissionMatrixView } from '../permission-matrix-view'

/** The server's message, or a generic fallback. Never a swallowed error. */
function messageOf(error: unknown, fallback: string): string {
  const response = (error as { response?: { data?: { error?: string } } })?.response
  return response?.data?.error ?? (error as Error)?.message ?? fallback
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
          setSaveError(messageOf(error, t('common.saveError', 'ذخیره ناموفق بود'))),
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
      error={saveError ?? (loadError ? messageOf(loadError, '') : null)}
      onSetCell={handleSetCell}
      onSelectRole={toggleRole}
      selectedRoleId={selectedRoleId}
      roleMembers={roleMembers}
    />
  )
})

PermissionsContainer.displayName = 'PermissionsContainer'
