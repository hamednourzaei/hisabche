'use client'

import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { customersSkeleton } from '@hisabche/ui'

const CustomerDetail = dynamic(
  () => import('@hisabche/ui').then((m) => m.CustomerDetailContainer),
  {
    loading: () => customersSkeleton(),
    ssr: false,
  },
)

export function CustomerDetailClient({ customerId }: { customerId: string }) {
  const router = useRouter()

  // Prefer real history so the list is restored with its scroll position and
  // filters; fall back to the list route when this page was opened directly
  // from a link, where there is nothing to go back to.
  const handleBack = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back()
    else router.push('/customers')
  }, [router])

  return <CustomerDetail customerId={customerId} onBack={handleBack} />
}
