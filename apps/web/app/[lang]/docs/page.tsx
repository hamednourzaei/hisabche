// apps/web/app/[lang]/docs/page.tsx
//
// ⚠️ THERE IS NO DOCS INDEX PAGE. This route is a permanent redirect.
//
// The index was a page whose entire content was a list of links to the real
// pages — a reader arriving at `/docs` had to make one more choice before
// reading a single sentence, and every article was one click further away than
// it needed to be. The article list is in the sidebar (and in a menu on a
// phone) on every article page, so the index had nothing the destination does
// not already have.
//
// `permanentRedirect` is a 308, deliberately: `/docs` has been linked and
// indexed, and a temporary redirect would leave the ranking on a URL that no
// longer renders anything. `apps/web/app/sitemap.ts` no longer lists `/docs`
// for the same reason — a sitemap should not advertise a redirect.
//
// The docs stay PUBLIC. This route sits outside the (dashboard) group, so it
// is readable without logging in, which is what the owner asked for and what
// someone evaluating the product needs.

import { permanentRedirect } from 'next/navigation'

import { DOCS_ENTRY_SLUG } from '@hisabche/ui'

import { resolveLocale } from '../i18n-config'

export default async function DocsIndexPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  // Resolved, not passed through: `/xx/docs` must land on a real locale rather
  // than build a redirect to a URL that then 404s.
  permanentRedirect(`/${resolveLocale(lang)}/docs/${DOCS_ENTRY_SLUG}`)
}
