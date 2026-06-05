"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import * as Dialog from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { Button, Input } from "@hisabche/ui"
import {
  useWorkspaceStore,
  type WorkspaceRole,
} from "@hisabche/store"
import { cn } from "../../lib/utils"

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
      invitedBy: "current-user",
      invitedAt: Date.now(),
      status: "pending",
    })
    setSent(true)
    setTimeout(() => {
      setSent(false)
      setEmail("")
      onClose()
    }, 1500)
  }

  return (
    <Dialog.Root open={open} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          )}
        />
        <Dialog.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-50 w-full max-w-sm translate-x-[-50%] translate-y-[-50%] gap-4",
            "rounded-xl border border-[var(--hisab-border)] bg-[var(--hisab-background)] p-6 shadow-lg",
            "duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
            "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]"
          )}
          onInteractOutside={onClose}
          onEscapeKeyDown={onClose}
        >
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-lg font-bold text-[var(--hisab-foreground)]">
              {t("workspace.inviteMember", "دعوت عضو جدید")}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className={cn(
                  "rounded-full p-1 text-[var(--hisab-muted-fg)]",
                  "hover:bg-[var(--hisab-muted)] hover:text-[var(--hisab-foreground)]",
                  "transition-colors"
                )}
                aria-label={t("action.close")}
              >
                <X className="size-4" aria-hidden />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-4">
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("auth.email", "ایمیل")}
              autoFocus
            />

            <select
              value={role}
              onChange={(e) => setRole(e.target.value as WorkspaceRole)}
              className="w-full rounded-xl border border-[var(--hisab-border)] bg-[var(--hisab-card)] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--hisab-primary)]/20"
            >
              <option value="admin">
                {t("workspace.admin", "مدیر")}
              </option>
              <option value="employee">
                {t("workspace.employee", "کارمند")}
              </option>
            </select>

            <p className="text-xs text-[var(--hisab-muted-fg)]">
              {t(
                "workspace.roleHint",
                "مدیر می‌تواند فاکتور و محصولات را مدیریت کند. کارمند فقط می‌تواند فاکتور ثبت کند."
              )}
            </p>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="w-full" onClick={onClose}>
                {t("common.cancel")}
              </Button>
              <Button
                className="w-full"
                onClick={handleInvite}
                disabled={!email.trim() || sent}
              >
                {sent
                  ? t("workspace.invited", "دعوت شد ✅")
                  : t("workspace.sendInvite", "ارسال دعوت")}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}