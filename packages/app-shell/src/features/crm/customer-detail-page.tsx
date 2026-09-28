// ============================================
// Customer detail — sales, purchases, payments and receipts, plus export.
// The container owns its back button, the same on every host.
// ============================================

import React from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { CustomerDetailContainer } from '@hisabche/ui/screens'

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()

  // A hash URL can be hand-edited or restored from a stale window; without an
  // id the container would query for `undefined` and render an empty profile.
  if (!id) return <Navigate to="/customers" replace />

  return <CustomerDetailContainer customerId={id} />
}
