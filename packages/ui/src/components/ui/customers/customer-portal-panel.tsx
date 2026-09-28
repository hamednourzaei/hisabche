'use client'

// ============================================
// packages/ui/src/components/ui/customers/customer-portal-panel.tsx
//
// The customer's portal link: make one, copy it to send, revoke it.
// A self-contained panel like CustomerProfilePanel — the customer screen
// mounts it in the account tab.
//
// ⚠️ The link shows this customer their invoices, payments and balance to
// anyone holding it. The panel says so where the link is made.
// ============================================

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Copy, Link2 } from 'lucide-react'
import {
  apiErrorMessage,
  useCreatePortalLink,
  useCustomerPortalLinks,
  useRevokePortalLink,
} from '@hisabche/api'
import { localizePath } from '@hisabche/ui-contract'

import { useDateFormat } from '../../../hooks/use-date-format'
import { Button } from '../button'
import { useToast } from '../toast-provider'

export function CustomerPortalPanel({ customerId }: { customerId: string }) {
  const tOriginal = useTranslations()
  const t = (key: string, fallback?: string): string => {
    const v = tOriginal(key as Parameters<typeof tOriginal>[0])
    return v && v !== key ? v : (fallback ?? key)
  }
  const toast = useToast()
  const { dateTime } = useDateFormat()
  // The reader's own language — the link opens the public site, which always
  // has a locale prefix, from web and desktop alike.
  const locale = useLocale()
  const links = useCustomerPortalLinks(customerId)
  const create = useCreatePortalLink(customerId)
  const revoke = useRevokePortalLink(customerId)

  // The public page lives on the website; a packaged desktop app runs from
  // file://, so the public site is the link's home there. Read in an effect.
  const [origin, setOrigin] = useState('')
  useEffect(() => {
    setOrigin(
      window.location.protocol.startsWith('http') ? window.location.origin : 'https://hisabche.com',
    )
  }, [])
  const urlFor = (token: string) => `${origin}${localizePath(`/portal/${token}`, locale)}`

  const status = (links.error as { response?: { status?: number } } | null)?.response?.status
  const live = (links.data ?? []).filter((l) => !l.revoked_at)

  const copy = (value: string) => {
    navigator.clipboard
      ?.writeText(value)
      .then(() => toast.success(t('portal.copied')))
      .catch(() => toast.error(t('portal.copyFailed')))
  }

  return (
    <section className="space-y-3 rounded-2xl border border-[hsl(var(--border-default))] p-4">
      <div className="flex items-center gap-2">
        <Link2 className="size-5 text-[hsl(var(--color-primary))]" aria-hidden="true" />
        <h3 className="font-semibold text-[hsl(var(--fg-primary))]">{t('portal.panelTitle')}</h3>
      </div>
      <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('portal.panelHelp')}</p>

      {links.isLoading ? (
        <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('portal.loading')}</p>
      ) : status === 503 ? (
        <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('portal.notConfigured')}</p>
      ) : links.error ? (
        <p className="text-sm text-[hsl(var(--color-destructive))]">
          {apiErrorMessage(links.error, t('portal.loadError'))}
        </p>
      ) : (
        <>
          {live.length === 0 ? (
            <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('portal.noLinks')}</p>
          ) : (
            <ul className="space-y-2">
              {live.map((link) => (
                <li
                  key={link.id}
                  className="space-y-1 rounded-xl bg-[hsl(var(--surface-muted))] p-3 text-sm"
                >
                  <code dir="ltr" className="block break-all text-xs">
                    {urlFor(link.token)}
                  </code>
                  <p className="text-xs text-[hsl(var(--fg-tertiary))]">
                    {link.last_used_at
                      ? `${t('portal.lastOpened')}: ${dateTime(link.last_used_at)}`
                      : t('portal.neverOpened')}
                    {link.expires_at
                      ? ` · ${t('portal.expires')}: ${dateTime(link.expires_at)}`
                      : ''}
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => copy(urlFor(link.token))}>
                      <Copy className="size-4" aria-hidden="true" />
                      {t('portal.copy')}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      loading={revoke.isPending && revoke.variables === link.id}
                      onClick={() =>
                        revoke.mutate(link.id, {
                          onError: (err) =>
                            toast.error(apiErrorMessage(err, t('portal.actionFailed'))),
                        })
                      }
                    >
                      {t('portal.revoke')}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Button
            size="sm"
            loading={create.isPending}
            onClick={() =>
              create.mutate(
                {},
                { onError: (err) => toast.error(apiErrorMessage(err, t('portal.actionFailed'))) },
              )
            }
          >
            {t('portal.create')}
          </Button>
        </>
      )}
    </section>
  )
}
