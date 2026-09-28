import React, { Suspense } from 'react'
import { useParams } from 'react-router-dom'
import { PublicPortalContainer } from '@hisabche/ui/screens'
import { Skeleton } from '@/components/ui/primitives'

export default function PublicPortalPage() {
  const { token } = useParams<{ token: string }>()
  if (!token) return null
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <PublicPortalContainer token={token} />
    </Suspense>
  )
}
