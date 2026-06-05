"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "../button"
import { Card, CardContent } from "../card"
import { Badge } from "../badge"
import { useWorkspaceStore, type WorkspaceMember } from "@hisabche/store"
import { InviteModal } from "../invite-modal"
import { Users, UserPlus, Crown, Shield, User } from "lucide-react"

const roleIconMap: Record<string, React.ReactNode> = {
  owner: <Crown className="size-4 text-warning" aria-hidden />,
  admin: <Shield className="size-4 text-primary" aria-hidden />,
}

const roleBadgeVariant: Record<string, "warning" | "default" | "secondary"> = {
  owner: "warning",
  admin: "default",
  employee: "secondary",
}

export function WorkspacePage() {
  const { t } = useTranslation()
  const { workspaceName, members, currentUserRole } = useWorkspaceStore()
  const [showInvite, setShowInvite] = useState(false)

  const roleLabel = (role: string) => {
    switch (role) {
      case "owner": return t("workspace.owner", "مالک")
      case "admin": return t("workspace.admin", "مدیر")
      default: return t("workspace.employee", "کارمند")
    }
  }

  const isAdmin = currentUserRole === "owner" || currentUserRole === "admin"

  return (
    <div className="space-y-6">
      <InviteModal open={showInvite} onClose={() => setShowInvite(false)} />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold sm:text-3xl text-foreground">
            {t("workspace.title", "ورک‌اسپیس")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {workspaceName || t("workspace.defaultName", "ورک‌اسپیس من")}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowInvite(true)} className="gap-2">
            <UserPlus className="size-4" aria-hidden />
            {t("workspace.inviteMember", "دعوت عضو")}
          </Button>
        )}
      </div>

      {/* Members */}
      <Card className="glass-card border-border">
        <CardContent className="p-6">
          <div className="mb-4 flex items-center gap-2">
            <Users className="size-5 text-primary" aria-hidden />
            <h2 className="text-lg font-semibold text-foreground">
              {t("workspace.members", "اعضا")} ({members.length})
            </h2>
          </div>
          {members.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("workspace.noMembers", "هنوز عضوی اضافه نشده")}
            </p>
          ) : (
            <div className="space-y-2">
              {members.map((member: WorkspaceMember) => (
                <div key={member.id} className="flex items-center justify-between rounded-xl border border-border p-4">
                  <div className="flex items-center gap-3 text-start">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
                      {member.fullName?.charAt(0) || "?"}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{member.fullName}</p>
                      <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                    </div>
                  </div>
                  <Badge variant={roleBadgeVariant[member.role] || "secondary"} className="shrink-0">
                    <span className="flex items-center gap-1">
                      {roleIconMap[member.role] || <User className="size-4 text-muted-foreground" aria-hidden />}
                      {roleLabel(member.role)}
                    </span>
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Permissions */}
      <Card className="glass-card border-border">
        <CardContent className="space-y-3 p-6 text-start">
          <h3 className="font-semibold text-foreground">{t("workspace.permissions", "دسترسی‌ها")}</h3>
          <div className="grid gap-2 text-sm">
            <div className="flex items-center gap-2">
              <Crown className="size-4 text-warning" aria-hidden />
              <span className="text-muted-foreground">{t("workspace.ownerPerms", "مالک: دسترسی کامل به همه چیز")}</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="size-4 text-primary" aria-hidden />
              <span className="text-muted-foreground">{t("workspace.adminPerms", "مدیر: مدیریت محصولات، فاکتورها و دعوت اعضا")}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="size-4 text-muted-foreground" aria-hidden />
              <span className="text-muted-foreground">{t("workspace.employeePerms", "کارمند: فقط ثبت فاکتور و مشاهده")}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}