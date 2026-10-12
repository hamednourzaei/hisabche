// apps/web/app/[lang]/my-attendance/[token]/page.tsx
// An employee's own attendance — opened from the link their manager sent.
// Public, token-gated, outside (dashboard).

import type { Metadata } from 'next'
import { AttendanceSelfContainer } from '@hisabche/ui'

const titles: Record<string, string> = {
  fa: 'حضور و غیاب من',
  af: 'حضور و غیاب من',
  en: 'My attendance',
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>
}): Promise<Metadata> {
  const { lang } = await params
  return {
    title: titles[lang] || titles['fa'],
    // A real person's working hours, to anyone holding the token — the same
    // rules as /portal: no index, no snippet, no archive, and no hreflang
    // alternates between private token URLs.
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
      <AttendanceSelfContainer token={token} />
    </main>
  )
}
