'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect, useState } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { useAuthStore } from '@hisabche/store'
import { getMessages, resolveMessage } from '@hisabche/i18n/messages'
import { cn } from '@/lib/utils'
import { localePath, resolveLocale } from './i18n-config'

/* ═══════════════════════════════════════════════════════════════════════════
   GlobalError v2 — Hisabche Design Language
   Zero hardcoded colors — all tokens from design system
   ═══════════════════════════════════════════════════════════════════════════ */

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  /*
   * ⚠️ THE LOCALE IS READ IN AN EFFECT, NOT DURING RENDER.
   *
   * This component replaces the root layout, so there is no `params` and no
   * intl provider — the only place the locale still exists is the URL. Reading
   * `window.location` during render is a hydration mismatch under React 19 and
   * throws the whole tree away, which on THIS screen means losing the error
   * report itself. So the escape link starts at the default locale and is
   * corrected once mounted.
   */
  const [href, setHref] = useState<string>(localePath('fa', ''))

  /*
   * ⚠️ TRANSLATED WITHOUT A PROVIDER.
   *
   * `useTranslations` needs `NextIntlClientProvider`, which lives in the root
   * layout this component REPLACES — calling it here would throw inside the
   * error screen and leave the user with nothing at all. The catalogs are
   * plain JSON, so they are read directly: same three locales, same keys, no
   * provider. Starts at the default locale and is corrected on mount for the
   * same hydration reason as the link above.
   */
  const [lang, setLang] = useState<string>('fa')
  const catalog = getMessages(lang)
  const tr = (key: string, fallback: string) => resolveMessage(catalog, key) ?? fallback

  useEffect(() => {
    Sentry.captureException(error)
    // Sentry can be unconfigured or blocked; the console is what is left, and
    // a boundary that hides the cause is worse than the crash.
    console.error('[global-error]', error?.digest ?? '', error)
  }, [error])

  useEffect(() => {
    const segment = window.location.pathname.split('/')[1] ?? ''
    const resolved = resolveLocale(segment)
    const authed = useAuthStore.getState().isAuthenticated
    setLang(resolved)
    setHref(localePath(resolved, authed ? '/dashboard' : ''))
  }, [])

  return (
    <html lang={lang} dir={lang === 'en' ? 'ltr' : 'rtl'}>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--surface-base))] p-6">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 rounded-2xl bg-[hsl(var(--color-destructive)/0.1)] flex items-center justify-center mx-auto mb-6">
              <AlertTriangle
                className="size-10 text-[hsl(var(--color-destructive))]"
                aria-hidden="true"
              />
            </div>
            <h1 className="text-2xl font-bold text-[hsl(var(--fg-primary))] mb-3">
              {tr('error.title', 'خطای سیستمی')}
            </h1>
            <p className="text-sm text-[hsl(var(--fg-secondary))] mb-6">
              {tr('error.description', 'اطلاعات شما امن است. لطفاً دوباره تلاش کنید.')}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={reset}
                className={cn(
                  'inline-flex items-center gap-2 px-6 py-3 rounded-xl',
                  'text-sm font-bold text-white',
                  'bg-[image:var(--gradient-brand)]',
                  'transition-all duration-200 hover:brightness-110 active:scale-[0.98]',
                  'motion-reduce:transition-none',
                )}
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                {tr('action.retry', 'تلاش دوباره')}
              </button>
              {/* Signed in → the dashboard. Signed out → the landing page.
                Same rule as every other boundary, read from the same store. */}
              <a
                href={href}
                className={cn(
                  'inline-flex items-center gap-2 px-6 py-3 rounded-xl',
                  'text-sm font-bold text-[hsl(var(--fg-secondary))]',
                  'border border-[hsl(var(--border-default))]',
                  'transition-colors duration-200 hover:bg-[hsl(var(--surface-muted))]',
                  'motion-reduce:transition-none',
                )}
              >
                <Home className="size-4" aria-hidden="true" />
                {tr(
                  href.endsWith('/dashboard') ? 'error.backToDashboard' : 'error.backToLanding',
                  'ادامه',
                )}
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
