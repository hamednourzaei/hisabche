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

/**
 * Inside `landing`, only the keys the landing's CLIENT parts read — header and
 * menu, pricing, FAQ, footer. The hero, features, security and capability text
 * is rendered by server components and never needs to reach the browser as a
 * message (feature-page and legal-page copy alone is ~25 KB).
 * Guarded by landing-client-message-keys.test.ts in packages/ui.
 */
export const LANDING_CLIENT_KEY_PREFIXES = [
  'cta',
  'faq',
  'footer',
  'menu',
  'nav',
  'pricing',
] as const

export function pickLandingClientMessages(messages: AbstractIntlMessages): AbstractIntlMessages {
  const picked = pickNamespaces(messages, LANDING_NAMESPACES)
  const landing = picked.landing
  if (landing && typeof landing === 'object') {
    picked.landing = Object.fromEntries(
      Object.entries(landing).filter(([key]) =>
        LANDING_CLIENT_KEY_PREFIXES.some((prefix) => key.startsWith(prefix)),
      ),
    ) as AbstractIntlMessages
  }
  return picked
}

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
  /** Omit for the full catalogue; `'landing-client'` for the landing page. */
  namespaces?: readonly string[] | 'landing-client' | undefined
  children: ReactNode
}) {
  const locale = resolveLocale(lang)
  const messages = await getMessages({ locale })
  const scoped =
    namespaces === 'landing-client'
      ? pickLandingClientMessages(messages)
      : namespaces
        ? pickNamespaces(messages, namespaces)
        : messages
  return (
    <IntlProvider locale={locale} messages={scoped}>
      {children}
    </IntlProvider>
  )
}

/**
 * `landing.*` keys the standalone public pages (about, contact, legal/*,
 * features/*) read on the client: LegalPageClient, ContactPageClient,
 * FeaturePageClient and SiteFooter. Guarded by public-page-message-keys.test.ts.
 */
export const PUBLIC_PAGE_KEY_PREFIXES = ['legalPage', 'featurePage', 'footer'] as const

/**
 * Layout body for about / contact / legal / features.
 *
 * ⚠️ These pages used FullMessagesLayout: the whole catalogue (~160 KB of
 * dashboard, admin and invoice-builder strings) was serialised into every
 * page's HTML — SEMrush "large page" on 30 URLs per locale, 513–522 KB each.
 */
export async function PublicPageMessagesLayout({
  params,
  children,
}: {
  params: Promise<{ lang: string }>
  children: ReactNode
}) {
  const { lang } = await params
  const locale = resolveLocale(lang)
  const messages = await getMessages({ locale })
  const picked = pickNamespaces(messages, CORE_NAMESPACES)
  const landing = messages.landing
  if (landing && typeof landing === 'object') {
    picked.landing = Object.fromEntries(
      Object.entries(landing).filter(([key]) =>
        PUBLIC_PAGE_KEY_PREFIXES.some((prefix) => key.startsWith(prefix)),
      ),
    ) as AbstractIntlMessages
  }
  return (
    <IntlProvider locale={locale} messages={picked}>
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
