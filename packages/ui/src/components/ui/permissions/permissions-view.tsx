// packages/ui/src/components/ui/permissions/permissions-view.tsx
"use client";

import { cn } from "@/lib/utils";
import { Shield, Check, X, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { memo } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   PermissionsView v3 — Honest static explainer.
   ✅ The workspace role enum (owner/admin/member/viewer) is the ONLY thing
      that actually gates access in this app today (see requireRole in
      backend/src/services/workspace.service.ts). It only governs team/
      workspace-management actions (invite, remove member, change role,
      delete workspace) — it does not yet restrict individual business
      modules (invoices, accounting, CRM, ...).
   ✅ There used to be a "create custom role + toggle permissions" UI here
      backed by a separate global (non-workspace-scoped) RBAC table set
      that no route in the app ever checked — creating a role there had
      zero effect on what any user could do. It has been removed rather
      than left as a non-functional feature.
   ═══════════════════════════════════════════════════════════════════════════ */

interface RoleCapability {
  key: "owner" | "admin" | "member" | "viewer";
  label: string;
  capabilities: { label: string; allowed: boolean }[];
}

interface PermissionsViewProps {
  t: (key: string, fallback?: string) => string;
}

function buildRoles(t: (key: string, fallback?: string) => string): RoleCapability[] {
  const caps = (allowed: boolean[]) => [
    { label: t("permissions.cap.invite", "دعوت اعضای جدید"), allowed: allowed[0]! },
    { label: t("permissions.cap.removeMember", "حذف اعضا"), allowed: allowed[1]! },
    { label: t("permissions.cap.changeRole", "تغییر نقش اعضا"), allowed: allowed[2]! },
    { label: t("permissions.cap.deleteWorkspace", "حذف فضای کاری"), allowed: allowed[3]! },
    { label: t("permissions.cap.useAllModules", "استفاده از تمام ماژول‌ها (فاکتور، حسابداری، انبار و...)"), allowed: allowed[4]! },
  ];

  return [
    { key: "owner", label: t("workspace.owner", "مالک"), capabilities: caps([true, true, true, true, true]) },
    { key: "admin", label: t("workspace.admin", "مدیر"), capabilities: caps([true, true, true, false, true]) },
    { key: "member", label: t("workspace.employee", "کارمند"), capabilities: caps([false, false, false, false, true]) },
    { key: "viewer", label: t("workspace.viewer", "ناظر"), capabilities: caps([false, false, false, false, true]) },
  ];
}

const RoleCard = memo(function RoleCard({ role }: { role: RoleCapability }) {
  return (
    <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-5 space-y-3">
      <h3 className="font-semibold text-[hsl(var(--fg-primary))]">{role.label}</h3>
      <div className="space-y-2">
        {role.capabilities.map((cap) => (
          <div key={cap.label} className="flex items-center gap-2 text-xs">
            {cap.allowed ? (
              <Check className="size-3.5 shrink-0 text-[hsl(var(--color-success))]" />
            ) : (
              <X className="size-3.5 shrink-0 text-[hsl(var(--fg-tertiary))]" />
            )}
            <span className={cap.allowed ? "text-[hsl(var(--fg-primary))]" : "text-[hsl(var(--fg-tertiary))]"}>
              {cap.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
});
RoleCard.displayName = "RoleCard";

export const PermissionsView = memo(function PermissionsView({ t }: PermissionsViewProps) {
  const router = useRouter();
  const roles = buildRoles(t);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2">
        <Shield className="size-6 text-[hsl(var(--color-primary))]" />
        <h1 className="text-2xl font-bold text-[hsl(var(--fg-primary))]">
          {t("nav.access", "دسترسی‌ها")}
        </h1>
      </div>

      <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted)/0.4)] p-4">
        <p className="text-sm text-[hsl(var(--fg-secondary))]">
          {t(
            "permissions.honestNote",
            "دسترسی در حسابچه فعلاً بر اساس همین ۴ نقش تیم مدیریت می‌شود؛ محدودسازی دقیق هر ماژول (مثلاً دسترسی فقط‌خواندنی به حسابداری) هنوز پیاده‌سازی نشده است."
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {roles.map((role) => (
          <RoleCard key={role.key} role={role} />
        ))}
      </div>

      <button
        onClick={() => router.push("/workspace")}
        className={cn(
          "inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold",
          "bg-[hsl(var(--color-primary))] text-[hsl(var(--color-primary-fg))] hover:brightness-110 transition"
        )}
      >
        {t("permissions.manageMembers", "مدیریت نقش اعضا در فضای کاری")}
        <ArrowLeft className="size-4 rtl:rotate-180" />
      </button>
    </div>
  );
});

PermissionsView.displayName = "PermissionsView";
