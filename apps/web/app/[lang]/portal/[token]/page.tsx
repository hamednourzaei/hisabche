// apps/web/app/[lang]/portal/[token]/page.tsx
// A customer's own account — invoices, payments, balance — opened from the
// link the business sent them. Public, token-gated, outside (dashboard).

import type { Metadata } from 'next'
import { PublicPortalContainer } from '@hisabche/ui'

const titles: Record<string, string> = {
  fa: 'حساب شما',
  af: 'حساب شما',
  en: 'Your account',
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>
}): Promise<Metadata> {
  const { lang } = await params
  return {
    title: titles[lang] || titles['fa'],
    // A real customer's balance and invoices, to anyone holding the token —
    // the same rules as /public-invoice: no index, no snippet, no archive,
    // and no hreflang alternates between private token URLs.
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
      <PublicPortalContainer token={token} />
    </main>
  )
}
