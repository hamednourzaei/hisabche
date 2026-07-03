// packages/ui/src/components/ui/permissions/permissions-view.tsx
"use client";

import { cn } from "@/lib/utils";
import { Shield, Plus, Trash2, Check, X } from "lucide-react";
import { useState } from "react";

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

// گروه‌بندی permissionها بر اساس resource
// Fix: اضافه کردن null check برای map[p.resource]
function groupPermissions(permissions: Permission[]) {
  const map: Record<string, Permission[]> = {};
  for (const p of permissions) {
    const resource = p.resource || "general"; // fallback اگر undefined بود
    if (!map[resource]) {
      map[resource] = [];
    }
    map[resource]!.push(p); // ✅ non-null assertion چون همین الان چک کردیم
  }
  return map;
}

export function PermissionsView({ t, roles, permissions, isLoading, onCreateRole, onDeleteRole }: PermissionsViewProps) {
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });

  const groupedPerms = groupPermissions(permissions);

  const handleCreate = async () => {
    await onCreateRole({ name: form.name, description: form.description, permissionIds: [] });
    setShowForm(false);
    setForm({ name: "", description: "" });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="size-6 text-[hsl(var(--color-primary))]" />
          <h1 className="text-2xl font-bold text-[hsl(var(--fg-primary))]">{t("permissions.title", "نقش‌ها و دسترسی‌ها")}</h1>
        </div>
        <button onClick={() => setShowForm(!showForm)} className={cn(
          "inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold",
          "bg-[hsl(var(--color-primary))] text-[hsl(var(--color-primary-fg))]",
        )}>
          <Plus className="size-4" />
          {t("permissions.newRole", "نقش جدید")}
        </button>
      </div>

      {/* Quick Add Form */}
      {showForm && (
        <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input placeholder={t("permissions.roleName", "نام نقش")} value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-4 py-2.5 text-sm" />
            <input placeholder={t("permissions.description", "شرح")} value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-4 py-2.5 text-sm" />
          </div>
          <div className="flex gap-3">
            <button onClick={handleCreate} className="rounded-full bg-[hsl(var(--color-primary))] text-white px-6 py-2.5 text-sm font-bold">{t("action.save", "ذخیره")}</button>
            <button onClick={() => setShowForm(false)} className="rounded-full border border-[hsl(var(--border-default))] px-6 py-2.5 text-sm">{t("action.cancel", "لغو")}</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Roles List */}
        <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] overflow-hidden">
          <div className="p-4 border-b border-[hsl(var(--border-default))]">
            <h2 className="font-semibold text-[hsl(var(--fg-primary))]">{t("permissions.roles", "نقش‌ها")}</h2>
          </div>
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-10 rounded-lg bg-[hsl(var(--surface-muted))] animate-pulse" />)}
            </div>
          ) : (
            <div className="divide-y divide-[hsl(var(--border-default))]">
              {roles.map((role) => (
                <button
                  key={role.id}
                  onClick={() => setSelectedRole(role)}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-3 text-start hover:bg-[hsl(var(--surface-muted)/0.5)] transition-colors",
                    selectedRole?.id === role.id && "bg-[hsl(var(--color-primary)/0.08)] border-s-2 border-s-[hsl(var(--color-primary))]",
                  )}
                >
                  <div>
                    <p className="font-medium text-sm text-[hsl(var(--fg-primary))]">{role.name}</p>
                    {role.description && <p className="text-xs text-[hsl(var(--fg-secondary))]">{role.description}</p>}
                  </div>
                  {!role.is_system && (
                    <button onClick={(e) => { e.stopPropagation(); onDeleteRole(role.id); }} className="p-1 rounded hover:bg-[hsl(var(--color-destructive)/0.1)] text-[hsl(var(--color-destructive))] opacity-0 group-hover:opacity-100">
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Permissions Matrix */}
        <div className="lg:col-span-2 rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] overflow-hidden">
          <div className="p-4 border-b border-[hsl(var(--border-default))]">
            <h2 className="font-semibold text-[hsl(var(--fg-primary))]">
              {selectedRole ? `${t("permissions.forRole", "دسترسی‌های")}: ${selectedRole.name}` : t("permissions.selectRole", "یک نقش انتخاب کنید")}
            </h2>
          </div>
          <div className="p-4">
            {!selectedRole ? (
              <p className="text-sm text-[hsl(var(--fg-secondary))] py-8 text-center">{t("permissions.selectRoleHint", "برای مشاهده دسترسی‌ها، یک نقش از سمت راست انتخاب کنید")}</p>
            ) : (
              <div className="space-y-4">
                {Object.entries(groupedPerms).map(([resource, perms]) => (
                  <div key={resource}>
                    <h3 className="text-sm font-semibold text-[hsl(var(--fg-primary))] mb-2 uppercase">{resource}</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {perms.map((perm) => {
                        const hasPerm = selectedRole.permissions?.some((p) => p.permission_id === perm.id);
                        return (
                          <div key={perm.id} className={cn(
                            "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs",
                            hasPerm
                              ? "border-[hsl(var(--color-success)/0.3)] bg-[hsl(var(--color-success)/0.05)] text-[hsl(var(--color-success))]"
                              : "border-[hsl(var(--border-default))] text-[hsl(var(--fg-tertiary))]",
                          )}>
                            {hasPerm ? <Check className="size-3.5 shrink-0" /> : <X className="size-3.5 shrink-0" />}
                            {perm.name}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}