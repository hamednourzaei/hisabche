import React, { Suspense } from 'react'
import { useParams } from 'react-router-dom'
import { AttendanceSelfContainer } from '@hisabche/ui/screens'
import { Skeleton } from '@/components/ui/primitives'

export default function AttendanceSelfPage() {
  const { token } = useParams<{ token: string }>()
  if (!token) return null
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <AttendanceSelfContainer token={token} />
    </Suspense>
  )
}
