// ============================================
// The one dialog that asks for an authenticator code when the server refuses a
// sensitive action with WORKSPACE_STEP_UP_REQUIRED (V61 B.2.25).
//
// The API client holds the refused request; this host registers itself with
// `setStepUpHandler` and resolves to the new access token (AAL2) — or null when
// the person cancels, which makes the original request fail with the server's
// own message. Mounted once per shell, inside the signed-in layout (web
// dashboard layout, app-shell layout), never on public pages.
//
// ⚠️ Nothing about the factor is cached: the handler asks the server which
// factor this person has at the moment it is needed.
// ============================================
'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { fetchTwoFactorStatus, setStepUpHandler, verifyTwoFactorCode } from '@hisabche/api'
import { useAuthStore } from '@hisabche/store'

import { Button } from '../button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../dialog'
import { Input } from '../input'
import { capabilityLabelKey } from './two-factor-section'

interface PendingStepUp {
  capability: string | null
  factorId: string | null
  resolve: (token: string | null) => void
}

export function StepUpDialogHost() {
  const t = useTranslations('settings.twoFactor')
  const [pending, setPending] = useState<PendingStepUp | null>(null)
  const [code, setCode] = useState('')
  const [invalid, setInvalid] = useState(false)
  const [busy, setBusy] = useState(false)
  const pendingRef = useRef<PendingStepUp | null>(null)

  useEffect(() => {
    setStepUpHandler(async (capability) => {
      let factorId: string | null = null
      try {
        const status = await fetchTwoFactorStatus()
        factorId = status.enrolled ? status.factorId : null
      } catch {
        factorId = null
      }
      return new Promise<string | null>((resolve) => {
        const next = { capability, factorId, resolve }
        pendingRef.current = next
        setCode('')
        setInvalid(false)
        setPending(next)
      })
    })
    return () => {
      setStepUpHandler(null)
      pendingRef.current?.resolve(null)
      pendingRef.current = null
    }
  }, [])

  const close = (token: string | null) => {
    pendingRef.current?.resolve(token)
    pendingRef.current = null
    setPending(null)
    setBusy(false)
  }

  const submit = async () => {
    if (!pending?.factorId || !/^\d{6}$/.test(code)) {
      setInvalid(true)
      return
    }
    setBusy(true)
    try {
      const session = await verifyTwoFactorCode({ factorId: pending.factorId, code })
      const adopted = useAuthStore
        .getState()
        .adoptVerifiedSession({ token: session.token, refreshToken: session.refreshToken })
      close(adopted ? session.token : null)
    } catch {
      setInvalid(true)
      setBusy(false)
    }
  }

  return (
    <Dialog open={pending !== null} onOpenChange={(open) => (open ? undefined : close(null))}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('stepUp.title')}</DialogTitle>
          <DialogDescription>
            {pending?.factorId ? t('stepUp.description') : t('stepUp.notEnrolled')}
          </DialogDescription>
        </DialogHeader>
        {pending?.capability ? (
          <p className="text-xs text-[hsl(var(--fg-secondary))]">
            {t('stepUp.action')}: {t(capabilityLabelKey(pending.capability))}
          </p>
        ) : null}
        {pending?.factorId ? (
          <div className="space-y-2">
            <Input
              name="code"
              dir="ltr"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
              value={code}
              placeholder="000000"
              aria-label={t('codeLabel')}
              aria-invalid={invalid}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                setInvalid(false)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submit()
              }}
              className="text-center tabular-nums tracking-widest"
            />
            {invalid ? (
              <p className="text-xs text-[hsl(var(--color-destructive))]">{t('invalidCode')}</p>
            ) : null}
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => close(null)}>
            {t('cancel')}
          </Button>
          {pending?.factorId ? (
            <Button disabled={busy} onClick={() => void submit()}>
              {t('confirm')}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
