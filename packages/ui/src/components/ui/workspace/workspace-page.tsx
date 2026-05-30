"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button, Card, CardContent, Badge } from "@hisabche/ui"
import { useWorkspaceStore, type WorkspaceMember } from "@hisabche/store"
import { InviteModal } from "../invite-modal"
import { Users, UserPlus, Crown, Shield, User } from "lucide-react"

export function WorkspacePage() {
  const { t } = useTranslation()
  const { workspaceName, members, currentUserRole } = useWorkspaceStore()
  const [showInvite, setShowInvite] = useState(false)

  const roleIcon = (role: string) => {
    switch (role) {
      case 'owner': return <Crown className="size-4 text-[var(--hisab-warning)]" />
      case 'admin': return <Shield className="size-4 text-[var(--hisab-primary)]" />
      default: return <User className="size-4 text-[var(--hisab-muted-fg)]" />
    }
  }

  const roleLabel = (role: string) => {
    switch (role) {
      case 'owner': return t("workspace.owner", "مالک")
      case 'admin': return t("workspace.admin", "مدیر")
      default: return t("workspace.employee", "کارمند")
    }
  }

  return (
    <div className="space-y-6">
      <InviteModal open={showInvite} onClose={() => setShowInvite(false)} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("workspace.title", "ورک‌اسپیس")}</h1>
          <p className="mt-1 text-sm text-[var(--hisab-muted-fg)]">
            {workspaceName || t("workspace.defaultName", "ورک‌اسپیس من")}
          </p>
        </div>
        {(currentUserRole === 'owner' || currentUserRole === 'admin') && (
          <Button onClick={() => setShowInvite(true)} icon={<UserPlus className="size-4" />}>
            {t("workspace.inviteMember", "دعوت عضو")}
          </Button>
        )}
      </div>

      {/* Members list */}
      <Card className="glass-card">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="size-5 text-[var(--hisab-primary)]" />
            <h2 className="text-lg font-semibold">
              {t("workspace.members", "اعضا")} ({members.length})
            </h2>
          </div>

          {members.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--hisab-muted-fg)]">
              {t("workspace.noMembers", "هنوز عضوی اضافه نشده")}
            </p>
          ) : (
            <div className="space-y-2">
              {members.map((member: WorkspaceMember) => (
                <div key={member.id} className="flex items-center justify-between rounded-xl border border-[var(--hisab-border)] p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--hisab-primary)]/10 text-[var(--hisab-primary)] font-bold">
                      {member.fullName?.charAt(0) || "?"}
                    </div>
                    <div>
                      <p className="font-medium">{member.fullName}</p>
                      <p className="text-xs text-[var(--hisab-muted-fg)]">{member.email}</p>
                    </div>
                  </div>
                  <Badge variant={member.role === 'owner' ? 'warning' : member.role === 'admin' ? 'default' : 'secondary'} size="sm">
                    <span className="flex items-center gap-1">
                      {roleIcon(member.role)}
                      {roleLabel(member.role)}
                    </span>
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Permissions info */}
      <Card className="glass-card">
        <CardContent className="p-6 space-y-3">
          <h3 className="font-semibold">{t("workspace.permissions", "دسترسی‌ها")}</h3>
          <div className="grid gap-2 text-sm">
            <div className="flex items-center gap-2">
              <Crown className="size-4 text-[var(--hisab-warning)]" />
              <span className="text-[var(--hisab-muted-fg)]">{t("workspace.ownerPerms", "مالک: دسترسی کامل به همه چیز")}</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="size-4 text-[var(--hisab-primary)]" />
              <span className="text-[var(--hisab-muted-fg)]">{t("workspace.adminPerms", "مدیر: مدیریت محصولات، فاکتورها و دعوت اعضا")}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="size-4 text-[var(--hisab-muted-fg)]" />
              <span className="text-[var(--hisab-muted-fg)]">{t("workspace.employeePerms", "کارمند: فقط ثبت فاکتور و مشاهده")}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}