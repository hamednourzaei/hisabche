'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  Button,
  Input,
  Textarea,
  Label,
} from '@/components/ui'
import { useAdminStepUp } from '@/hooks/use-admin-security'
import { createAdminSupabaseClient } from '@/lib/supabase-client'

/** Verify a TOTP code with Supabase; the session's token then carries the check. */
async function verifyTotp(code: string): Promise<void> {
  const supabase = createAdminSupabaseClient()
  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors()
  if (listError) throw listError
  const factor = factors?.totp?.[0]
  if (!factor) throw new Error('MFA_NOT_ENROLLED')
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code })
  if (error) throw error
}

export interface StepUpDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  requireReason?: boolean
  reasonLabel?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: (data: { stepUpTimestamp: string; reason?: string }) => Promise<void> | void
}

export function StepUpDialog({
  open,
  onOpenChange,
  title,
  description,
  requireReason = false,
  reasonLabel,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
}: StepUpDialogProps) {
  const t = useTranslations()
  const { mutateAsync: stepUp, isPending: isStepUpPending } = useAdminStepUp()
  const [totpCode, setTotpCode] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setTotpCode('')
      setReason('')
      setError(null)
      setIsSubmitting(false)
    }
    onOpenChange(nextOpen)
  }

  const handleConfirm = async () => {
    if (requireReason && !reason.trim()) {
      setError(t('admin.security.reasonRequired'))
      return
    }

    try {
      setIsSubmitting(true)
      setError(null)

      await verifyTotp(totpCode.trim())
      const result = await stepUp()
      await onConfirm({
        stepUpTimestamp: result.stepUpTimestamp,
        reason: requireReason ? reason.trim() : undefined,
      })

      handleOpenChange(false)
    } catch (err: unknown) {
      const e = err as { message?: string } | undefined
      setError(e?.message ?? t('admin.security.stepUpFailed'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const busy = isStepUpPending || isSubmitting

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-start">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-start text-muted-foreground">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="step-up-totp">{t('admin.security.totpPrompt')}</Label>
            <Input
              id="step-up-totp"
              dir="ltr"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={8}
              placeholder="000000"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              className="text-center font-mono tracking-widest"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">{t('admin.security.totpHint')}</p>
          </div>

          {requireReason && (
            <div className="space-y-1.5">
              <Label htmlFor="step-up-reason">
                {reasonLabel ?? t('admin.security.reasonPrompt')}
                <span className="ms-1 text-destructive">*</span>
              </Label>
              <Textarea
                id="step-up-reason"
                rows={3}
                placeholder={t('admin.security.reasonPlaceholder')}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive"
            >
              {error}
            </div>
          )}
        </div>

        <AlertDialogFooter className="flex-row-reverse gap-2">
          <Button
            type="button"
            variant={destructive ? 'destructive' : 'default'}
            disabled={busy || (requireReason && !reason.trim())}
            onClick={() => void handleConfirm()}
          >
            {busy ? t('app.loading') : (confirmLabel ?? t('admin.security.confirmAction'))}
          </Button>
          <AlertDialogCancel disabled={busy} onClick={() => handleOpenChange(false)}>
            {cancelLabel ?? t('common.cancel')}
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
