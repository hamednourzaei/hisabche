// apps/web/app/[lang]/docs/page.tsx
//
// T12 — public documentation.
//
// ⚠️ PUBLIC ON PURPOSE. This route sits OUTSIDE the (dashboard) group, so it
// is readable without logging in — the owner asked for exactly that («با لاگین
// و بدون لاگین قابل دیدن باشد»), and someone evaluating the product needs to
// read it before they have an account.
//
// It is therefore also indexable, unlike the dashboard group which is noindex.

import type { Metadata } from 'next'
import { getMessages } from 'next-intl/server'

import { DocsClient } from './docs-client'
import { buildLegalMetadata } from '../legal/legal-metadata'
import { resolveLocale } from '../i18n-config'

export const revalidate = 3600

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>
}): Promise<Metadata> {
  const { lang } = await params
  // See the note in [slug]/page.tsx: `getMessages` throws on an unknown
  // locale, and a throw here is a 500 rather than a 404.
  const messages = (await getMessages({ locale: resolveLocale(lang) })) as Record<string, any>
  const docs = messages?.docs ?? {}

  return buildLegalMetadata({
    lang,
    path: '/docs',
    title: `${docs.title ?? 'Documentation'} — Hisabche`,
    description: docs.subtitle ?? '',
  })
}

export default async function DocsIndexPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return <DocsClient lang={lang} />
}
