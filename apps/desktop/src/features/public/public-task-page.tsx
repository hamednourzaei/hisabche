import React, { Suspense } from 'react'
import { useParams } from 'react-router-dom'
import { PublicTaskContainer } from '@hisabche/ui/screens'
import { Skeleton } from '@/components/ui/primitives'

export default function PublicTaskPage() {
  const { token } = useParams<{ token: string }>()
  if (!token) return null
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <PublicTaskContainer token={token} />
    </Suspense>
  )
}
