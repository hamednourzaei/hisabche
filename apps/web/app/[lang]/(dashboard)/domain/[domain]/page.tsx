// apps/web/app/[lang]/(dashboard)/domain/[domain]/page.tsx
'use client'

// One route for all four domains. Four near-identical page files would be four
// places to forget when a domain is added; the contract already knows the list,
// and the container validates the segment.
import { useParams, useRouter } from 'next/navigation'
import { DomainWorkspaceContainer } from '@hisabche/ui'

export default function DomainWorkspacePage() {
  const router = useRouter()
  const params = useParams<{ lang: string; domain: string }>()

  return (
    <DomainWorkspaceContainer
      domain={params.domain ?? ''}
      onNavigate={(path) => router.push(`/${params.lang}${path}`)}
    />
  )
}
