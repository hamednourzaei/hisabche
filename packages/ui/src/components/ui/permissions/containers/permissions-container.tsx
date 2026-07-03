// packages/ui/src/components/ui/permissions/containers/permissions-container.tsx
"use client";

import { useTranslation } from "react-i18next";
import { useRoles, usePermissions, useCreateRole, useDeleteRole } from "@hisabche/api";
import { PermissionsView } from "../permissions-view";

export function PermissionsContainer() {
  const { t } = useTranslation();
  const { data: roles, isLoading: rolesLoading } = useRoles();
  const { data: permissions, isLoading: permsLoading } = usePermissions();
  const createRole = useCreateRole();
  const deleteRole = useDeleteRole();

  const safeT = (key: string, fallback?: string) => {
    const result = t(key);
    return result !== key ? result : (fallback ?? key);
  };

  return (
    <PermissionsView
      t={safeT}
      roles={roles ?? []}
      permissions={permissions ?? []}
      isLoading={rolesLoading || permsLoading}
      onCreateRole={(values: Record<string, unknown>) => createRole.mutateAsync(values)}
      onDeleteRole={(id: string) => deleteRole.mutateAsync(id)}
    />
  );
}