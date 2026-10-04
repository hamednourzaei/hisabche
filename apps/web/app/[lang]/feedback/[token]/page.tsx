// apps/web/app/[lang]/feedback/[token]/page.tsx
// Public, unauthenticated: the page a campaign recipient reaches from the link
// in their email — to answer the NPS question or to stop the emails. Outside
// the (dashboard) route group so it never hits the auth-gated layout.

import type { Metadata } from 'next'
import { FeedbackContainer } from '@hisabche/ui'

const titles: Record<string, string> = {
  fa: 'نظر شما',
  af: 'نظر شما',
  en: 'Your feedback',
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>
}): Promise<Metadata> {
  const { lang } = await params
  return {
    title: titles[lang] || titles['fa'],
    // A token URL: it names a business to one customer. Never indexed, never
    // cached, and no hreflang between token URLs.
    robots: {
      index: false,
      follow: false,
      nocache: true,
      nosnippet: true,
      noarchive: true,
      googleBot: { index: false, follow: false, nosnippet: true },
    },
  }
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ score?: string; unsubscribe?: string }>
}) {
  const { token } = await params
  const query = await searchParams
  const score =
    query.score !== undefined && /^[0-9]{1,2}$/.test(query.score) ? Number(query.score) : undefined
  return (
    <main className="section py-10">
      <FeedbackContainer
        token={token}
        initialScore={score}
        startUnsubscribe={query.unsubscribe === '1'}
      />
    </main>
  )
}
