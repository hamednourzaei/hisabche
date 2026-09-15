// apps/web/app/[lang]/scoped-messages.tsx
//
// ⚠️ WHICH TRANSLATIONS A PAGE SHIPS TO THE BROWSER.
//
// The root layout used to hand the WHOLE catalogue (86 namespaces, ~160 KB of
// JSON for fa — budgets, payroll, invoice builder…) to the client provider, so
// every public page carried it inside its HTML's RSC payload. PageSpeed's mobile
// run spent 850 ms downloading that HTML before the LCP image could start.
//
// The root layout now ships only CORE_NAMESPACES. Each route tree re-provides
// what it needs through <ScopedMessages>: the landing gets its own namespaces,
// every other route gets the full catalogue. A nested NextIntlClientProvider
// REPLACES its parent's messages, it does not merge — so a scoped set must
// include the core namespaces too.
import type { ReactNode } from 'react'
import type { AbstractIntlMessages } from 'next-intl'
import { getMessages } from 'next-intl/server'

import { IntlProvider } from './intl-provider'
import { resolveLocale } from './i18n-config'

/** Used by the root chrome: error boundaries, toasts, the auth gate. */
export const CORE_NAMESPACES = ['app', 'auth', 'error', 'action', 'common'] as const

/** Everything the landing page's client tree reads (see landing-i18n-keys.test.ts). */
export const LANDING_NAMESPACES = [...CORE_NAMESPACES, 'landing', 'faq'] as const

export function pickNamespaces(
  messages: AbstractIntlMessages,
  namespaces: readonly string[],
): AbstractIntlMessages {
  const picked: AbstractIntlMessages = {}
  for (const name of namespaces) {
    const value = messages[name]
    if (value !== undefined) picked[name] = value
  }
  return picked
}

export async function ScopedMessages({
  lang,
  namespaces,
  children,
}: {
  lang: string
  /** Omit for the full catalogue. */
  namespaces?: readonly string[] | undefined
  children: ReactNode
}) {
  const locale = resolveLocale(lang)
  const messages = await getMessages({ locale })
  return (
    <IntlProvider
      locale={locale}
      messages={namespaces ? pickNamespaces(messages, namespaces) : messages}
    >
      {children}
    </IntlProvider>
  )
}

/** Layout body for route trees that need the full catalogue. */
export async function FullMessagesLayout({
  params,
  children,
}: {
  params: Promise<{ lang: string }>
  children: ReactNode
}) {
  const { lang } = await params
  return <ScopedMessages lang={lang}>{children}</ScopedMessages>
}
