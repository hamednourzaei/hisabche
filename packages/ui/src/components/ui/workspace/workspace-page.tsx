"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useWorkspaceStore, useAuthStore, type WorkspaceMember, type WorkspaceRole } from "@hisabche/store";
import { useRemoveMember, useUpdateMemberRole } from "@hisabche/api";
import { InviteModal } from "../invite-modal";
import { Users, UserPlus, Crown, Shield, User, X } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */

const roleIconMap: Record<string, React.ReactNode> = {
  owner: <Crown className="size-4 text-[hsl(var(--color-warning))]" />,
  admin: <Shield className="size-4 text-[hsl(var(--color-primary))]" />,
};

const badgeStyles: Record<string, string> = {
  warning: "bg-[hsl(var(--color-warning)/0.12)] text-[hsl(var(--color-warning))] border-[hsl(var(--color-warning)/0.2)]",
  default: "bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))] border-[hsl(var(--color-primary)/0.2)]",
  secondary: "bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-secondary))] border-[hsl(var(--border-default))]",
};

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export function WorkspacePage() {
  const { t } = useTranslation();
  const { workspaceId, workspaceName, members, currentUserRole, loading, fetchWorkspace } = useWorkspaceStore();
  const userId = useAuthStore((s) => s.user?.id);
  const removeMember = useRemoveMember();
  const updateRole = useUpdateMemberRole();
  const [showInvite, setShowInvite] = useState(false);

// Fetch workspace on mount
useEffect(() => {
  if (userId) {
    fetchWorkspace(userId);
  }
}, [userId]); // ✅ فقط userId — یکبار اجرا میشه
  const roleLabel = (role: string) => {
    switch (role) {
      case "owner": return t("workspace.owner", "مالک");
      case "admin": return t("workspace.admin", "مدیر");
      default: return t("workspace.employee", "کارمند");
    }
  };

  const isOwner = currentUserRole === "owner";
  const isAdmin = isOwner || currentUserRole === "admin";

  const handleRemove = async (memberId: string) => {
    if (!confirm(t("workspace.confirmRemove", "آیا از حذف این عضو اطمینان دارید؟"))) return;
    try {
      await removeMember.mutateAsync({ workspaceId: workspaceId!, memberId });
      if (userId) fetchWorkspace(userId);
    } catch {
      alert(t("workspace.removeFailed", "حذف عضو ناموفق بود"));
    }
  };

  const handleRoleChange = async (memberId: string, newRole: WorkspaceRole) => {
    try {
      await updateRole.mutateAsync({ workspaceId: workspaceId!, memberId, role: newRole });
      if (userId) fetchWorkspace(userId);
    } catch {
      alert(t("workspace.roleChangeFailed", "تغییر نقش ناموفق بود"));
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-[hsl(var(--surface-muted))] rounded-lg" />
        <div className="h-40 bg-[hsl(var(--surface-muted))] rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <InviteModal open={showInvite} onClose={() => setShowInvite(false)} />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold sm:text-3xl text-[hsl(var(--fg-primary))]">
            {t("workspace.title", "ورک‌اسپیس")}
          </h1>
          <p className="text-sm text-[hsl(var(--fg-secondary))]">
            {workspaceName || t("workspace.defaultName", "ورک‌اسپیس من")}
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowInvite(true)}
            className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold bg-[hsl(var(--color-primary))] text-white shadow-sm shadow-[hsl(var(--color-primary)/0.15)] transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
          >
            <UserPlus className="size-4" />
            {t("workspace.inviteMember", "دعوت عضو")}
          </button>
        )}
      </div>

      {/* Members */}
      <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]">
        <div className="p-6">
          <div className="mb-4 flex items-center gap-2">
            <Users className="size-5 text-[hsl(var(--color-primary))]" />
            <h2 className="text-lg font-semibold text-[hsl(var(--fg-primary))]">
              {t("workspace.members", "اعضا")} ({members.length})
            </h2>
          </div>
          {members.length === 0 ? (
            <p className="py-8 text-center text-sm text-[hsl(var(--fg-tertiary))]">
              {t("workspace.noMembers", "هنوز عضوی اضافه نشده")}
            </p>
          ) : (
            <div className="space-y-2">
              {members.map((member) => {
                const badgeStyle = badgeStyles[
                  member.role === "owner" ? "warning" : member.role === "admin" ? "default" : "secondary"
                ] ?? badgeStyles.secondary;

                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between rounded-xl border border-[hsl(var(--border-default))] p-4"
                  >
                    <div className="flex items-center gap-3 text-start">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--color-primary)/0.12)] font-bold text-[hsl(var(--color-primary))]">
                        {member.fullName?.charAt(0) || "?"}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-[hsl(var(--fg-primary))]">
                          {member.fullName}
                        </p>
                        <p className="truncate text-xs text-[hsl(var(--fg-secondary))]">
                          {member.email}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isOwner && member.role !== "owner" ? (
                        <select
                          value={member.role}
                          onChange={(e) => handleRoleChange(member.id, e.target.value as WorkspaceRole)}
                          className="text-xs rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] text-[hsl(var(--fg-primary))] px-2 py-1 cursor-pointer"
                          aria-label={t("workspace.changeRole", "تغییر نقش")}
                        >
                          <option value="admin">{t("workspace.admin", "مدیر")}</option>
                          <option value="member">{t("workspace.employee", "کارمند")}</option>
                          <option value="viewer">{t("workspace.viewer", "ناظر")}</option>
                        </select>
                      ) : (
                        <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border shrink-0 gap-1", badgeStyle)}>
                          {roleIconMap[member.role] || <User className="size-4 text-[hsl(var(--fg-secondary))]" />}
                          {roleLabel(member.role)}
                        </span>
                      )}

                      {isAdmin && member.role !== "owner" && (
                        <button
                          onClick={() => handleRemove(member.id)}
                          className="p-1 rounded-lg text-[hsl(var(--fg-tertiary))] hover:bg-[hsl(var(--color-destructive)/0.1)] hover:text-[hsl(var(--color-destructive))] transition-colors"
                          aria-label={t("workspace.removeMember", "حذف عضو")}
                        >
                          <X className="size-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Permissions */}
      <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]">
        <div className="space-y-3 p-6 text-start">
          <h3 className="font-semibold text-[hsl(var(--fg-primary))]">
            {t("workspace.permissions", "دسترسی‌ها")}
          </h3>
          <div className="grid gap-2 text-sm text-[hsl(var(--fg-secondary))]">
            <div className="flex items-center gap-2">
              <Crown className="size-4 text-[hsl(var(--color-warning))]" />
              <span>{t("workspace.ownerPerms", "مالک: دسترسی کامل به همه چیز")}</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="size-4 text-[hsl(var(--color-primary))]" />
              <span>{t("workspace.adminPerms", "مدیر: مدیریت محصولات، فاکتورها و دعوت اعضا")}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="size-4 text-[hsl(var(--fg-secondary))]" />
              <span>{t("workspace.employeePerms", "کارمند: فقط ثبت فاکتور و مشاهده")}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}