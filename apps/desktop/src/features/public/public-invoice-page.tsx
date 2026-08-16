import React, { Suspense } from 'react'
import { useParams } from 'react-router-dom'
import { PublicInvoiceContainer } from '@hisabche/ui/screens'
import { Skeleton } from '@/components/ui/primitives'

export default function PublicInvoicePage() {
  const { token } = useParams<{ token: string }>()
  if (!token) return null
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <PublicInvoiceContainer token={token} />
    </Suspense>
  )
}
