// ============================================
// packages/ui/src/components/ui/invite-modal.tsx
// ============================================
'use client'

import { SelectField } from './select-field'
import { useState, useCallback, memo } from 'react'
import { useTranslations } from 'next-intl'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Check, ChevronDown, Copy } from 'lucide-react'
import { type WorkspaceRole } from '@hisabche/store'
import { useInviteMember } from '@hisabche/api'
import { cn } from '../../lib/utils'
import { planLimitMessage } from '../../lib/plan-limit-message'

/* ═══════════════════════════════════════════════════════════════════════════
   InviteModal v2 — Memoized · Performance Optimized
   ✅ memo · useCallback · safeT wrapper
   ═══════════════════════════════════════════════════════════════════════════ */

interface Props {
  open: boolean
  onClose: () => void
  workspaceId: string
}

export const InviteModal = memo(function InviteModal({ open, onClose, workspaceId }: Props) {
  const tOriginal = useTranslations()

  const t = (key: string, fallback?: string): string => {
    const v = tOriginal(key as Parameters<typeof tOriginal>[0])

    return v && v !== key ? v : (fallback ?? key)
  }

  // ✅ safeT wrapper

  const inviteMember = useInviteMember()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<WorkspaceRole>('member')
  const [sent, setSent] = useState(false)
  const [inviteLink, setInviteLink] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const handleInvite = useCallback(async () => {
    if (!email.trim() || !workspaceId) return
    setError('')
    try {
      const response = await inviteMember.mutateAsync({
        workspaceId,
        email: email.trim(),
        role,
      })
      // ✅ FIX: بدون پیشوند زبان، لینک به مسیر اشتباه می‌رفت (صفحه فقط
      // زیر app/[lang]/accept-invite وجود دارد)
      const currentLangSegment = window.location.pathname.split('/')[1] || 'af'
      const link = `${window.location.origin}/${currentLangSegment}/accept-invite?token=${response?.token ?? ''}`
      setInviteLink(link)
      setSent(true)
    } catch (err: any) {
      setError(
        planLimitMessage(err, (key, values) => t(key, values as never)) ||
          err?.message ||
          t('workspace.inviteError', 'خطا در ارسال دعوت'),
      )
    }
  }, [email, workspaceId, role, inviteMember, t])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      document.getElementById('invite-link-input')?.focus()
    }
  }, [inviteLink])

  const handleClose = useCallback(() => {
    setSent(false)
    setInviteLink('')
    setEmail('')
    setError('')
    setCopied(false)
    onClose()
  }, [onClose])

  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value)
    setError('')
  }, [])

  const handleRoleChange = useCallback((value: string) => {
    setRole(value as WorkspaceRole)
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleInvite()
      }
    },
    [handleInvite],
  )

  const isPending = inviteMember.isPending

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-[hsl(var(--surface-base)/0.6)] backdrop-blur-md',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          )}
        />
        <Dialog.Content
          className={cn(
            'fixed z-50 w-[calc(100%-32px)] max-w-sm left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-elevated))] shadow-xl p-6',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
          )}
        >
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-bold text-[hsl(var(--fg-primary))]">
              {sent
                ? t('workspace.invited', 'دعوت شد')
                : t('workspace.inviteMember', 'دعوت عضو جدید')}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                onClick={handleClose}
                className="rounded-full p-1.5 text-[hsl(var(--fg-tertiary))] hover:bg-[hsl(var(--surface-muted))] min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="size-4" />
              </button>
            </Dialog.Close>
          </div>

          {sent ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 rounded-xl bg-[hsl(var(--color-success)/0.08)] border border-[hsl(var(--color-success)/0.2)]">
                <Check className="size-5 text-[hsl(var(--color-success))] shrink-0" />
                <p className="text-sm text-[hsl(var(--color-success))]">
                  {t('workspace.inviteSent', 'ایمیل دعوت برای کاربر ارسال شد')}
                </p>
              </div>

              <div>
                <p className="text-xs text-[hsl(var(--fg-secondary))] mb-1.5">
                  {t('workspace.inviteLinkLabel', 'یا لینک دعوت را مستقیم ارسال کنید:')}
                </p>
                <div className="flex items-center gap-2 p-3 rounded-xl bg-[hsl(var(--surface-base))] border border-[hsl(var(--border-default))]">
                  <input
                    id="invite-link-input"
                    type="text"
                    value={inviteLink}
                    readOnly
                    className="flex-1 text-xs bg-transparent text-[hsl(var(--fg-primary))] outline-none select-all"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button
                    onClick={handleCopy}
                    className="shrink-0 flex items-center gap-1 text-xs font-bold text-[hsl(var(--color-primary))] hover:underline"
                  >
                    {copied ? (
                      <>
                        <Check className="size-3.5" />
                        {t('workspace.copied', 'کپی شد')}
                      </>
                    ) : (
                      <>
                        <Copy className="size-3.5" />
                        {t('workspace.copy', 'کپی')}
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[10px] text-[hsl(var(--fg-tertiary))] mt-1.5">
                  {t(
                    'workspace.inviteLinkHint',
                    'این لینک را برای کاربر ارسال کنید. لینک تا ۷ روز معتبر است.',
                  )}
                </p>
              </div>

              <button
                onClick={handleClose}
                className="w-full rounded-full px-4 py-2.5 text-sm font-bold text-white bg-[hsl(var(--color-primary))]"
              >
                {t('action.done', 'تمام')}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <input
                type="email"
                value={email}
                onChange={handleEmailChange}
                onKeyDown={handleKeyDown}
                placeholder={t('auth.email', 'ایمیل')}
                autoFocus
                className="w-full rounded-xl px-4 py-3 text-sm border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] text-[hsl(var(--fg-primary))] focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)]"
              />

              <div className="relative">
                <SelectField
                  value={role}
                  onChange={handleRoleChange}
                  options={[
                    { value: 'admin', label: t('workspace.admin', 'مدیر') },
                    { value: 'member', label: t('workspace.employee', 'کارمند') },
                    { value: 'viewer', label: t('workspace.viewer', 'ناظر') },
                  ]}
                  className={
                    'w-full rounded-xl px-4 py-3 pe-10 text-sm appearance-none cursor-pointer border-2 border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] text-[hsl(var(--fg-primary))]'
                  }
                />
                <ChevronDown className="absolute end-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--fg-tertiary))] pointer-events-none" />
              </div>

              {error && <p className="text-xs text-[hsl(var(--color-destructive))]">{error}</p>}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleClose}
                  className="w-full rounded-full px-4 py-2.5 text-sm border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))]"
                >
                  {t('action.cancel', 'انصراف')}
                </button>
                <button
                  onClick={handleInvite}
                  disabled={!email.trim() || isPending}
                  className="w-full rounded-full px-4 py-2.5 text-sm font-bold text-white bg-[hsl(var(--color-primary))] disabled:opacity-40"
                >
                  {isPending
                    ? t('app.loading', 'در حال ارسال...')
                    : t('workspace.sendInvite', 'ارسال دعوت')}
                </button>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
})

InviteModal.displayName = 'InviteModal'
