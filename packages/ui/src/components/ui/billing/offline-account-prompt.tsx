// ============================================
// packages/ui/src/components/ui/billing/offline-account-prompt.tsx
// Prompts an OFFLINE account signing in on a device:
// «حساب شما آفلاین است - استفاده به صورت محلی» with [ادامه] and [ارتقا به آنلاین]
// ============================================

'use client'

import React from 'react'
import { HardDrive, ArrowUpRight } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import Link from 'next/link'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../dialog'
import { billingHref } from './subscription-lock'

export interface OfflineAccountPromptProps {
  open: boolean
  onClose: () => void
  onContinueOffline: () => void
  hashRouter?: boolean | undefined
}

export function OfflineAccountPrompt({
  open,
  onClose,
  onContinueOffline,
  hashRouter = false,
}: OfflineAccountPromptProps) {
  const t = useTranslations()
  const locale = useLocale()

  const safeT = (key: string, fallback: string): string => {
    try {
      const res = t(key as Parameters<typeof t>[0])
      return res && res !== key ? res : fallback
    } catch {
      return fallback
    }
  }

  const title = safeT('entitlement.offlineAccount.deviceTitle', 'حساب شما آفلاین است')
  const message = safeT(
    'entitlement.offlineAccount.deviceMessage',
    'حساب شما آفلاین است - استفاده به صورت محلی',
  )
  const continueText = safeT('entitlement.offlineAccount.continuePrompt', 'ادامه')
  const upgradeText = safeT('entitlement.offlineAccount.upgradePrompt', 'ارتقا به آنلاین')

  return (
    <Dialog open={open} onOpenChange={(isOpen) => (!isOpen ? onClose() : undefined)}>
      <DialogContent className="max-w-md text-center">
        <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))]">
          <HardDrive className="size-7" aria-hidden="true" />
        </div>
        <DialogTitle className="text-xl font-bold text-[hsl(var(--fg-primary))]">
          {title}
        </DialogTitle>
        <DialogDescription className="mt-2 text-sm leading-relaxed text-[hsl(var(--fg-secondary))]">
          {message}
        </DialogDescription>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={onContinueOffline}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[image:var(--gradient-brand)] px-5 text-sm font-semibold text-white shadow-sm hover:brightness-110"
          >
            {continueText}
          </button>
          <Link
            href={billingHref(locale, hashRouter)}
            onClick={onClose}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-5 text-sm font-semibold text-[hsl(var(--fg-primary))] hover:bg-[hsl(var(--surface-muted))]"
          >
            <span>{upgradeText}</span>
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  )
}
