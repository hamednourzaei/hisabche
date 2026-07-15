// packages/ui/src/components/ui/permissions/containers/permissions-container.tsx
"use client";

import { useTranslation } from "react-i18next";
import { useRoles, usePermissions, useCreateRole, useDeleteRole } from "@hisabche/api";
import { PermissionsView } from "../permissions-view";
import { useCallback, memo } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   PermissionsContainer v2 — Memoized · Performance Optimized
   ✅ memo · useCallback · safeT
   ═══════════════════════════════════════════════════════════════════════════ */

export const PermissionsContainer = memo(function PermissionsContainer() {
  const { t: tOriginal } = useTranslation();

  // ✅ safeT wrapper
  const safeT = useCallback(
    (key: string, fallback?: string): string => {
      const result = tOriginal(key);
      return result && result !== key ? result : (fallback ?? key);
    },
    [tOriginal]
  );

  const { data: roles, isLoading: rolesLoading } = useRoles();
  const { data: permissions, isLoading: permsLoading } = usePermissions();
  const createRole = useCreateRole();
  const deleteRole = useDeleteRole();

  const handleCreateRole = useCallback(
    (values: Record<string, unknown>) => createRole.mutateAsync(values),
    [createRole]
  );

  const handleDeleteRole = useCallback(
    (id: string) => deleteRole.mutateAsync(id),
    [deleteRole]
  );

  return (
    <PermissionsView
      t={safeT}
      roles={roles ?? []}
      permissions={permissions ?? []}
      isLoading={rolesLoading || permsLoading}
      onCreateRole={handleCreateRole}
      onDeleteRole={handleDeleteRole}
    />
  );
});

PermissionsContainer.displayName = "PermissionsContainer";