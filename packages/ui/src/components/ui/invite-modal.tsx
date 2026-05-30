"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button, Input } from "@hisabche/ui"
import { useWorkspaceStore, type WorkspaceRole } from "@hisabche/store"
import { Modal } from "./Modal"

interface Props {
  open: boolean
  onClose: () => void
}

export function InviteModal({ open, onClose }: Props) {
  const { t } = useTranslation()
  const { addInvite, canInvite } = useWorkspaceStore()
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<WorkspaceRole>("employee")
  const [sent, setSent] = useState(false)

  if (!canInvite()) return null

  const handleInvite = () => {
    if (!email.trim()) return
    addInvite({
      id: `invite-${Date.now()}`,
      email: email.trim(),
      role,
      invitedBy: 'current-user',
      invitedAt: Date.now(),
      status: 'pending',
    })
    setSent(true)
    setTimeout(() => {
      setSent(false)
      setEmail("")
      onClose()
    }, 1500)
  }

  return (
    <Modal open={open} onClose={onClose} title={t("workspace.inviteMember", "دعوت عضو جدید")} size="sm">
      <Input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t("auth.email", "ایمیل")}
        autoFocus
      />
      <select
        value={role}
        onChange={(e) => setRole(e.target.value as WorkspaceRole)}
        className="w-full rounded-xl border border-[var(--hisab-border)] bg-[var(--hisab-background)] px-4 py-3 text-sm"
      >
        <option value="admin">{t("workspace.admin", "مدیر")}</option>
        <option value="employee">{t("workspace.employee", "کارمند")}</option>
      </select>
      <p className="text-xs text-[var(--hisab-muted-fg)]">
        {t("workspace.roleHint", "مدیر میتواند فاکتور و محصولات را مدیریت کند. کارمند فقط میتواند فاکتور ثبت کند.")}
      </p>
      <div className="flex gap-3 pt-2">
        <Button variant="outline" className="w-full" onClick={onClose}>{t("common.cancel")}</Button>
        <Button className="w-full" onClick={handleInvite} disabled={!email.trim() || sent}>
          {sent ? t("workspace.invited", "دعوت شد ✅") : t("workspace.sendInvite", "ارسال دعوت")}
        </Button>
      </div>
    </Modal>
  )
}