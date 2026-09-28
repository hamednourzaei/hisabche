// apps/web/app/[lang]/oauth/authorize/page.tsx
// The OAuth consent screen: an app sends a business owner here to approve
// access (RFC 6749 §4.1.1 + PKCE). Outside (dashboard) because a signed-out
// visitor must come back to THIS URL, query and all, after logging in.

import type { Metadata } from 'next'
import { OAuthConsentContainer, type OAuthAuthorizeQuery } from '@hisabche/ui'

const titles: Record<string, string> = {
  fa: 'اجازه‌ی دسترسی برنامه',
  af: 'اجازه‌ی دسترسی برنامه',
  en: 'Authorize app',
}

const FIELDS = [
  'response_type',
  'client_id',
  'redirect_uri',
  'scope',
  'state',
  'code_challenge',
  'code_challenge_method',
] as const

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>
}): Promise<Metadata> {
  const { lang } = await params
  return {
    title: titles[lang] || titles['fa'],
    robots: { index: false, follow: false, nocache: true },
  }
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const raw = await searchParams
  // A repeated parameter is malformed (RFC 6749 §3.1): it is dropped, and the
  // request then reads as invalid rather than picking one of the values.
  const query: OAuthAuthorizeQuery = {}
  for (const field of FIELDS) {
    const value = raw[field]
    if (typeof value === 'string') query[field] = value
  }
  return (
    <main className="section py-10">
      <OAuthConsentContainer query={query} />
    </main>
  )
}
