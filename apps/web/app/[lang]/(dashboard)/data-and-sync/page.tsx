// apps/web/app/[lang]/(dashboard)/data-and-sync/page.tsx
'use client'

// Thin, but a client component rather than the usual server page: the hub
// links to its six areas, and the router that does the linking is
// platform-specific. The shared container takes `onNavigate` so desktop can
// hand it React Router instead.
import { useParams, useRouter } from 'next/navigation'
import { DataAndSyncContainer } from '@hisabche/ui'

export default function DataAndSyncPage() {
  const router = useRouter()
  const { lang } = useParams<{ lang: string }>()

  // Every dashboard route is locale-prefixed. Pushing a bare `/conflicts`
  // would drop the language and bounce the user through the locale redirect.
  return <DataAndSyncContainer onNavigate={(path) => router.push(`/${lang}${path}`)} />
}
