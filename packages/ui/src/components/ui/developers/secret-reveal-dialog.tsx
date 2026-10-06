'use client'

// ============================================
// A key or secret that is shown ONCE — in front of the person, not somewhere
// up the page.
//
// It used to be a card at the top of «توسعه‌دهندگان», three panels above the
// form that created the key. The person pressed «ساخت کلید» at the bottom of a
// long page, the card appeared out of sight, and all they ever saw was the
// prefix in the list («hk_live_zfprTMCE…») — which cannot be copied into
// anything. The key was gone.
//
// Now it is a dialog: it cannot be missed, the value is in a field that
// selects itself on focus, «کپی» says whether it worked, and it closes only on
// «ذخیره کردم» — a click outside does not throw away a value that will never
// be shown again.
// ============================================

import { useEffect, useRef, useState } from 'react'
import { Check, Copy, KeyRound, TriangleAlert } from 'lucide-react'

import { copyText } from '../../../lib/copy-text'
import { Button } from '../button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../dialog'

type T = (key: string) => string

export function SecretRevealDialog({
  t,
  title,
  value,
  onDone,
}: {
  t: T
  /** What this is: «کلید API ساخته شد», … */
  title: string
  /** The secret; null closes the dialog. */
  value: string | null
  onDone: () => void
}) {
  const field = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')

  // A new secret starts un-copied.
  useEffect(() => {
    setState('idle')
  }, [value])

  const copy = async () => {
    if (!value) return
    const done = await copyText(value)
    setState(done ? 'copied' : 'failed')
    // Whatever happened, the value is selected: Ctrl+C still works.
    field.current?.select()
  }

  return (
    <Dialog open={value !== null}>
      <DialogContent
        className="max-w-lg"
        showCloseButton={false}
        data-secret-reveal=""
        // Shown once: not dismissed by accident.
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-5 text-[hsl(var(--color-primary))]" aria-hidden="true" />
            {title}
          </DialogTitle>
          <DialogDescription className="flex items-start gap-2 text-[hsl(var(--color-warning))]">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{t('developer.shownOnce')}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-stretch gap-2">
          <input
            ref={field}
            readOnly
            dir="ltr"
            name="secret"
            aria-label={title}
            value={value ?? ''}
            onFocus={(event) => event.currentTarget.select()}
            className="min-h-11 min-w-0 flex-1 rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))] px-3 font-mono text-xs text-[hsl(var(--fg-primary))] outline-none focus:border-[hsl(var(--color-primary))]"
          />
          <Button
            type="button"
            variant={state === 'copied' ? 'outline' : 'default'}
            className="min-h-11 shrink-0 whitespace-nowrap"
            onClick={() => void copy()}
          >
            {state === 'copied' ? (
              <Check className="size-4" aria-hidden="true" />
            ) : (
              <Copy className="size-4" aria-hidden="true" />
            )}
            {state === 'copied' ? t('developer.copied') : t('developer.copy')}
          </Button>
        </div>

        {state === 'failed' ? (
          <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
            {t('developer.copyFailed')}
          </p>
        ) : null}

        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={onDone}>
            {t('developer.savedIt')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
