// apps/web/app/[lang]/(dashboard)/people-workspace/page.tsx
'use client'

// Thin by design. A dynamic `[domain]` route would be one file instead of
// four, but `nav-destinations.test.ts` proves a destination reaches a screen by
// looking for its page file — and it cannot see a folder called `[domain]`.
// Four files a guard can check beat one file it cannot.
import { useParams, useRouter } from 'next/navigation'
import { DomainWorkspaceContainer } from '@hisabche/ui'

export default function PeopleWorkspacePage() {
  const router = useRouter()
  const { lang } = useParams<{ lang: string }>()

  return (
    <DomainWorkspaceContainer
      domain="people"
      onNavigate={(path) => router.push(`/${lang}${path}`)}
    />
  )
}
