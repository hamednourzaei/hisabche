// packages/ui/src/components/ui/permissions/permissions-view.tsx
"use client";

import { cn } from "@/lib/utils";
import { Shield, Plus, Trash2, Check, X } from "lucide-react";
import { useState, useCallback, useMemo, memo } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   PermissionsView v2 — Memoized · SaaS-Level · Performance Optimized
   ✅ memo · useCallback · useMemo · کامپوننت‌های جداگانه
   ═══════════════════════════════════════════════════════════════════════════ */

interface Role {
  id: string;
  name: string;
  description?: string;
  is_system?: boolean;
  permissions?: { permission_id: string }[];
}

interface Permission {
  id: string;
  code: string;
  name: string;
  resource: string;
  action: string;
}

interface PermissionsViewProps {
  t: (key: string, fallback?: string) => string;
  roles: Role[];
  permissions: Permission[];
  isLoading: boolean;
  onCreateRole: (values: Record<string, unknown>) => Promise<void>;
  onDeleteRole: (id: string) => Promise<void>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function groupPermissions(permissions: Permission[]): Record<string, Permission[]> {
  const map: Record<string, Permission[]> = {};
  for (const p of permissions) {
    const resource = p.resource || "general";
    if (!map[resource]) {
      map[resource] = [];
    }
    map[resource]!.push(p);
  }
  return map;
}

// ─── RoleForm ──────────────────────────────────────────────────────────────

const RoleForm = memo(function RoleForm({
  form,
  setForm,
  onSubmit,
  onCancel,
  t,
  isSubmitting,
}: {
  form: { name: string; description: string };
  setForm: (data: { name: string; description: string }) => void;
  onSubmit: () => void;
  onCancel: () => void;
  t: (key: string, fallback?: string) => string;
  isSubmitting: boolean;
}) {
  const handleFieldChange = useCallback(
    (field: "name" | "description", value: string) => {
      setForm({ ...form, [field]: value });
    },
    [form, setForm]
  );

  return (
    <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-6 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <input
          placeholder={t("permissions.roleName", "نام نقش")}
          value={form.name}
          onChange={(e) => handleFieldChange("name", e.target.value)}
          className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-4 py-2.5 text-sm focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)]"
        />
        <input
          placeholder={t("permissions.description", "شرح")}
          value={form.description}
          onChange={(e) => handleFieldChange("description", e.target.value)}
          className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-4 py-2.5 text-sm focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)]"
        />
      </div>
      <div className="flex gap-3">
        <button
          onClick={onSubmit}
          disabled={isSubmitting}
          className="rounded-full bg-[hsl(var(--color-primary))] text-white px-6 py-2.5 text-sm font-bold disabled:opacity-50"
        >
          {isSubmitting ? "..." : t("action.save", "ذخیره")}
        </button>
        <button
          onClick={onCancel}
          className="rounded-full border border-[hsl(var(--border-default))] px-6 py-2.5 text-sm"
        >
          {t("action.cancel", "لغو")}
        </button>
      </div>
    </div>
  );
});
RoleForm.displayName = "RoleForm";

// ─── RoleList ──────────────────────────────────────────────────────────────

const RoleList = memo(function RoleList({
  roles,
  selectedRoleId,
  onSelectRole,
  onDeleteRole,
  isLoading,
  t,
}: {
  roles: Role[];
  selectedRoleId: string | null;
  onSelectRole: (role: Role) => void;
  onDeleteRole: (id: string) => void;
  isLoading: boolean;
  t: (key: string, fallback?: string) => string;
}) {
  if (isLoading) {
    return (
      <div className="p-4 space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 rounded-lg bg-[hsl(var(--surface-muted))] animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="divide-y divide-[hsl(var(--border-default))]">
      {roles.map((role) => {
        const isSelected = selectedRoleId === role.id;
        return (
          <button
            key={role.id}
            type="button"
            onClick={() => onSelectRole(role)}
            className={cn(
              "group w-full flex items-center justify-between px-4 py-3 text-start hover:bg-[hsl(var(--surface-muted)/0.5)] transition-colors",
              isSelected && "bg-[hsl(var(--color-primary)/0.08)] border-s-2 border-s-[hsl(var(--color-primary))]"
            )}
          >
            <div>
              <p className="font-medium text-sm text-[hsl(var(--fg-primary))]">{role.name}</p>
              {role.description && (
                <p className="text-xs text-[hsl(var(--fg-secondary))]">{role.description}</p>
              )}
            </div>
            {!role.is_system && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteRole(role.id);
                }}
                className="p-1 rounded hover:bg-[hsl(var(--color-destructive)/0.1)] text-[hsl(var(--color-destructive))] opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label={t("action.delete", "حذف")}
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </button>
        );
      })}
    </div>
  );
});
RoleList.displayName = "RoleList";

// ─── PermissionMatrix ──────────────────────────────────────────────────────

const PermissionMatrix = memo(function PermissionMatrix({
  selectedRole,
  groupedPerms,
  t,
}: {
  selectedRole: Role | null;
  groupedPerms: Record<string, Permission[]>;
  t: (key: string, fallback?: string) => string;
}) {
  if (!selectedRole) {
    return (
      <p className="text-sm text-[hsl(var(--fg-secondary))] py-8 text-center">
        {t("permissions.selectRoleHint", "برای مشاهده دسترسی‌ها، یک نقش از سمت راست انتخاب کنید")}
      </p>
    );
  }

  const hasNoPermissions = Object.keys(groupedPerms).length === 0;

  if (hasNoPermissions) {
    return (
      <p className="text-sm text-[hsl(var(--fg-secondary))] py-8 text-center">
        {t("permissions.noPermissions", "هیچ دسترسی‌ای تعریف نشده است")}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {Object.entries(groupedPerms).map(([resource, perms]) => {
        const resourceLabel = t(`permissions.resource.${resource}`, resource);
        return (
          <div key={resource}>
            <h3 className="text-sm font-semibold text-[hsl(var(--fg-primary))] mb-2 uppercase">
              {resourceLabel}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {perms.map((perm) => {
                const hasPerm = selectedRole.permissions?.some(
                  (p) => p.permission_id === perm.id
                );
                return (
                  <div
                    key={perm.id}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs",
                      hasPerm
                        ? "border-[hsl(var(--color-success)/0.3)] bg-[hsl(var(--color-success)/0.05)] text-[hsl(var(--color-success))]"
                        : "border-[hsl(var(--border-default))] text-[hsl(var(--fg-tertiary))]"
                    )}
                  >
                    {hasPerm ? (
                      <Check className="size-3.5 shrink-0" />
                    ) : (
                      <X className="size-3.5 shrink-0" />
                    )}
                    {perm.name}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
});
PermissionMatrix.displayName = "PermissionMatrix";

// ─── Main Component ─────────────────────────────────────────────────────────

export const PermissionsView = memo(function PermissionsView({
  t,
  roles,
  permissions,
  isLoading,
  onCreateRole,
  onDeleteRole,
}: PermissionsViewProps) {
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ✅ useMemo برای groupedPerms
  const groupedPerms = useMemo(
    () => groupPermissions(permissions),
    [permissions]
  );

  const handleSelectRole = useCallback((role: Role) => {
    setSelectedRole(role);
  }, []);

  const handleCreate = useCallback(async () => {
    if (!form.name.trim()) return;
    setIsSubmitting(true);
    try {
      await onCreateRole({
        name: form.name,
        description: form.description,
        permissionIds: [],
      });
      setShowForm(false);
      setForm({ name: "", description: "" });
    } finally {
      setIsSubmitting(false);
    }
  }, [form, onCreateRole]);

  const handleCancelForm = useCallback(() => {
    setShowForm(false);
    setForm({ name: "", description: "" });
  }, []);

  const toggleForm = useCallback(() => {
    setShowForm((prev) => !prev);
  }, []);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="size-6 text-[hsl(var(--color-primary))]" />
          <h1 className="text-2xl font-bold text-[hsl(var(--fg-primary))]">
            {t("nav.access", "دسترسی‌ها")}
          </h1>
        </div>
        <button
          onClick={toggleForm}
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold",
            "bg-[hsl(var(--color-primary))] text-[hsl(var(--color-primary-fg))]",
            "hover:brightness-110 transition"
          )}
        >
          <Plus className="size-4" />
          {t("permissions.newRole", "نقش جدید")}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <RoleForm
          form={form}
          setForm={setForm}
          onSubmit={handleCreate}
          onCancel={handleCancelForm}
          t={t}
          isSubmitting={isSubmitting}
        />
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Roles List */}
        <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] overflow-hidden">
          <div className="p-4 border-b border-[hsl(var(--border-default))]">
            <h2 className="font-semibold text-[hsl(var(--fg-primary))]">
              {t("permissions.roles", "نقش‌ها")}
            </h2>
          </div>
          <RoleList
            roles={roles}
            selectedRoleId={selectedRole?.id ?? null}
            onSelectRole={handleSelectRole}
            onDeleteRole={onDeleteRole}
            isLoading={isLoading}
            t={t}
          />
        </div>

        {/* Permissions Matrix */}
        <div className="lg:col-span-2 rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] overflow-hidden">
          <div className="p-4 border-b border-[hsl(var(--border-default))]">
            <h2 className="font-semibold text-[hsl(var(--fg-primary))]">
              {selectedRole
                ? `${t("permissions.forRole", "دسترسی‌های")}: ${selectedRole.name}`
                : t("permissions.selectRole", "یک نقش انتخاب کنید")}
            </h2>
          </div>
          <div className="p-4">
            <PermissionMatrix
              selectedRole={selectedRole}
              groupedPerms={groupedPerms}
              t={t}
            />
          </div>
        </div>
      </div>
    </div>
  );
});

PermissionsView.displayName = "PermissionsView";