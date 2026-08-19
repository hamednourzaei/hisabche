// apps/web/app/[lang]/public-invoice/[token]/page.tsx
// Public, unauthenticated, read-only invoice view — reached via the QR
// code / share link on invoice-document.tsx. Intentionally outside the
// (dashboard) route group so it never hits the auth-gated layout.

import type { Metadata } from 'next'
import { PublicInvoiceContainer } from '@hisabche/ui'

const titles: Record<string, string> = {
  fa: 'مشاهده فاکتور',
  af: 'مشاهده فاکتور',
  en: 'View Invoice',
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>
}): Promise<Metadata> {
  const { lang } = await params
  return {
    title: titles[lang] || titles['fa'],
    // This URL renders a real customer's invoice — amounts, line items, the
    // buyer's name — to anyone holding the token. Beyond `index: false`:
    //   · nosnippet/noarchive stop the figures leaking into a SERP snippet or
    //     a cached copy even if the URL is discovered and fetched.
    //   · noimageindex keeps any logo/attachment out of image search.
    //   · The matching Disallow in app/robots.ts prevents the fetch happening
    //     at all; these directives are the second layer for crawlers that
    //     reach the page anyway (e.g. via a link-preview fetcher).
    // `alternates` is deliberately absent: hreflang between token URLs would
    // publish other locales' variants of a private document.
    robots: {
      index: false,
      follow: false,
      nocache: true,
      nosnippet: true,
      noarchive: true,
      noimageindex: true,
      googleBot: { index: false, follow: false, nosnippet: true, noimageindex: true },
    },
  }
}

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return (
    <main className="section py-10">
      <PublicInvoiceContainer token={token} />
    </main>
  )
}
