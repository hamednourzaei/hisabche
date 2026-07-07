"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Check, ChevronDown } from "lucide-react";
import { useWorkspaceStore, type WorkspaceRole } from "@hisabche/store";
import { useInviteMember } from "@hisabche/api";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function InviteModal({ open, onClose }: Props) {
  const { t } = useTranslation();
  const { workspaceId, canInvite } = useWorkspaceStore();
  const inviteMember = useInviteMember();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceRole>("member");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  if (!canInvite()) return null;

  const handleInvite = async () => {
    if (!email.trim() || !workspaceId) return;
    setError("");
    try {
      await inviteMember.mutateAsync({
        workspaceId,
        email: email.trim(),
        role,
      });
      setSent(true);
      setTimeout(() => {
        setSent(false);
        setEmail("");
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err?.message || "خطا در ارسال دعوت");
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 z-50",
            "bg-[hsl(var(--surface-base)/0.6)] backdrop-blur-md",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "motion-reduce:animate-none",
          )}
        />

        <Dialog.Content
          className={cn(
            "fixed z-50 w-[calc(100%-32px)] max-w-sm",
            "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
            "rounded-2xl",
            "border border-[hsl(var(--border-strong))]",
            "bg-[hsl(var(--surface-elevated))]",
            "shadow-xl",
            "p-6",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "motion-reduce:animate-none",
          )}
        >
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-bold text-[hsl(var(--fg-primary))]">
              {t("workspace.inviteMember", "دعوت عضو جدید")}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="rounded-full p-1.5 text-[hsl(var(--fg-tertiary))] hover:bg-[hsl(var(--surface-muted))] min-h-[44px] min-w-[44px] flex items-center justify-center">
                <X className="size-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("auth.email", "ایمیل")}
              autoFocus
              className="w-full rounded-xl px-4 py-3 text-sm border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] text-[hsl(var(--fg-primary))] focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)]"
            />

            <div className="relative">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as WorkspaceRole)}
                className="w-full rounded-xl px-4 py-3 pe-10 text-sm appearance-none cursor-pointer border-2 border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] text-[hsl(var(--fg-primary))]"
              >
                <option value="admin">{t("workspace.admin", "مدیر")}</option>
                <option value="member">{t("workspace.employee", "کارمند")}</option>
                <option value="viewer">{t("workspace.viewer", "ناظر")}</option>
              </select>
              <ChevronDown className="absolute end-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--fg-tertiary))] pointer-events-none" />
            </div>

            {error && (
              <p className="text-xs text-[hsl(var(--color-destructive))]">{error}</p>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={onClose} className="w-full rounded-full px-4 py-2.5 text-sm border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))]">
                {t("action.cancel", "انصراف")}
              </button>
              <button
                onClick={handleInvite}
                disabled={!email.trim() || sent || inviteMember.isPending}
                className="w-full rounded-full px-4 py-2.5 text-sm font-bold text-white bg-[hsl(var(--color-primary))] disabled:opacity-40"
              >
                {sent ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="size-4" />
                    {t("workspace.invited", "دعوت شد")}
                  </span>
                ) : inviteMember.isPending ? (
                  t("app.loading", "در حال ارسال...")
                ) : (
                  t("workspace.sendInvite", "ارسال دعوت")
                )}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}