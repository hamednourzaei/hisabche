// apps/web/app/[lang]/public-task/[token]/page.tsx
// Public, unauthenticated task view — reached via the link the owner
// shares with an employee who has no site account. Intentionally
// outside the (dashboard) route group so it never hits the auth-gated
// layout. Modeled on public-invoice/[token]/page.tsx.

import type { Metadata } from 'next'
import { PublicTaskContainer } from '@hisabche/ui'

const titles: Record<string, string> = {
  fa: 'مشاهده وظیفه',
  af: 'مشاهده وظیفه',
  en: 'View Task',
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>
}): Promise<Metadata> {
  const { lang } = await params
  return {
    // Token-shared internal task data — same reasoning as
    // public-invoice/[token]/page.tsx.
    title: titles[lang] || titles['fa'],
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
      <PublicTaskContainer token={token} />
    </main>
  )
}
