'use client'

// ============================================
// «به این بخش دسترسی ندارید» — what both shells draw INSTEAD of a page the
// person's role does not include.
//
// The page is not mounted behind it. That is the point: a denied page that
// mounts fires every query it has, each one answered 403 by the server, and
// shows a screen of errors — the data was never at risk (the server refuses),
// but the person was shown a broken product and the server did the work of
// refusing twenty requests.
//
// ⚠️ A rendering decision, not security. What decides is the server's own list
// (`/governance/my-capabilities`); every endpoint still enforces its
// capability whatever this component does.
//
// Not to be confused with a part the person hid for THEMSELVES
// (lib/page-look.ts): that is never a refusal.
// ============================================

import { ShieldOff } from 'lucide-react'
import { useTranslations } from 'next-intl'

export function NoAccessNotice({ onHome }: { onHome: () => void }) {
  const t = useTranslations('access')

  return (
    <div
      role="alert"
      data-no-access=""
      className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-16 text-center"
    >
      <span className="inline-flex size-12 items-center justify-center rounded-full bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-secondary))]">
        <ShieldOff className="size-6" aria-hidden="true" />
      </span>
      <h1 className="text-lg font-bold text-[hsl(var(--fg-primary))]">{t('deniedTitle')}</h1>
      <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('deniedBody')}</p>
      <button
        type="button"
        onClick={onHome}
        className="mt-2 inline-flex min-h-10 items-center whitespace-nowrap rounded-full bg-[hsl(var(--color-primary))] px-5 text-sm font-bold text-[hsl(var(--color-primary-fg))]"
      >
        {t('goHome')}
      </button>
    </div>
  )
}
