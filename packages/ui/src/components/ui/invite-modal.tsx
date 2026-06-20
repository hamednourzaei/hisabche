"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Check, ChevronDown } from "lucide-react";
import {
  useWorkspaceStore,
  type WorkspaceRole,
} from "@hisabche/store";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   InviteModal v4 — Hisabche Design Language
   ✅ Styled native select with custom dropdown arrow
   ✅ Blurred backdrop + centered modal
   ✅ Zero hardcoded colors — all tokens from design system
   ═══════════════════════════════════════════════════════════════════════════ */

interface Props {
  open: boolean;
  onClose: () => void;
}

export function InviteModal({ open, onClose }: Props) {
  const { t } = useTranslation();
  const { addInvite, canInvite } = useWorkspaceStore();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceRole>("employee");
  const [sent, setSent] = useState(false);

  if (!canInvite()) return null;

  const handleInvite = () => {
    if (!email.trim()) return;
    addInvite({
      id: `invite-${Date.now()}`,
      email: email.trim(),
      role,
      invitedBy: "current-user",
      invitedAt: Date.now(),
      status: "pending",
    });
    setSent(true);
    setTimeout(() => {
      setSent(false);
      setEmail("");
      onClose();
    }, 1500);
  };

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Dialog.Portal>
        {/* Overlay — blurred */}
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 z-50",
            "bg-[hsl(var(--surface-base)/0.6)] backdrop-blur-md",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "motion-reduce:animate-none",
          )}
        />

        {/* Content — centered */}
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
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "motion-reduce:animate-none",
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-bold text-[hsl(var(--fg-primary))]">
              {t("workspace.inviteMember", "دعوت عضو جدید")}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className={cn(
                  "rounded-full p-1.5",
                  "text-[hsl(var(--fg-tertiary))]",
                  "hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]",
                  "transition-colors duration-150",
                  "motion-reduce:transition-none",
                  "min-h-[44px] min-w-[44px] flex items-center justify-center",
                )}
                aria-label={t("action.close", "بستن")}
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          {/* Form */}
          <div className="space-y-4">
            {/* Email Input */}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("auth.email", "ایمیل")}
              autoFocus
              className={cn(
                "w-full rounded-xl px-4 py-3",
                "text-sm",
                "border border-[hsl(var(--border-default))]",
                "bg-[hsl(var(--surface-base))]",
                "text-[hsl(var(--fg-primary))]",
                "placeholder:text-[hsl(var(--fg-tertiary))]",
                "focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)] focus:ring-1 focus:ring-[hsl(var(--color-primary)/0.3)]",
                "transition-all duration-200",
                "motion-reduce:transition-none",
              )}
            />

            {/* Role Select — styled */}
            <div className="relative">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as WorkspaceRole)}
                className={cn(
                  "w-full rounded-xl px-4 py-3 pe-10",
                  "text-sm appearance-none cursor-pointer",
                  "border-2 border-[hsl(var(--border-default))]",
                  "bg-[hsl(var(--surface-base))]",
                  "text-[hsl(var(--fg-primary))]",
                  "focus:outline-none focus:border-[hsl(var(--color-primary))] focus:shadow-[0_0_0_4px_hsl(var(--color-primary)/0.1)]",
                  "hover:border-[hsl(var(--border-strong))]",
                  "transition-all duration-200",
                  "motion-reduce:transition-none",
                )}
              >
                <option value="admin">
                  {t("workspace.admin", "مدیر")}
                </option>
                <option value="employee">
                  {t("workspace.employee", "کارمند")}
                </option>
              </select>
              {/* Custom arrow */}
              <ChevronDown
                className="absolute end-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--fg-tertiary))] pointer-events-none"
                aria-hidden="true"
              />
            </div>

            {/* Hint */}
            <p className="text-xs text-[hsl(var(--fg-tertiary))] leading-relaxed">
              {t(
                "workspace.roleHint",
                "مدیر می‌تواند فاکتور و محصولات را مدیریت کند. کارمند فقط می‌تواند فاکتور ثبت کند.",
              )}
            </p>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className={cn(
                  "w-full rounded-full px-4 py-2.5",
                  "text-sm font-medium",
                  "border border-[hsl(var(--border-default))]",
                  "text-[hsl(var(--fg-secondary))]",
                  "hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]",
                  "transition-colors duration-150",
                  "motion-reduce:transition-none",
                )}
              >
                {t("common.cancel", "انصراف")}
              </button>

              <button
                type="button"
                onClick={handleInvite}
                disabled={!email.trim() || sent}
                className={cn(
                  "w-full rounded-full px-4 py-2.5",
                  "text-sm font-bold text-white",
                  "bg-[hsl(var(--color-primary))]",
                  "shadow-sm shadow-[hsl(var(--color-primary)/0.15)]",
                  "transition-all duration-200",
                  "hover:brightness-110",
                  "active:scale-[0.98]",
                  "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100",
                  "motion-reduce:transition-none",
                )}
              >
                {sent ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="size-4" aria-hidden="true" />
                    {t("workspace.invited", "دعوت شد")}
                  </span>
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