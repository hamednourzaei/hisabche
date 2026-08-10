// ============================================
// Customer detail — sales, purchases, payments and receipts, plus export.
// ============================================

import React, { useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CustomerDetailContainer } from '@hisabche/ui/screens'
import { Navigate } from 'react-router-dom'

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const handleBack = useCallback(() => navigate('/customers'), [navigate])

  // A hash URL can be hand-edited or restored from a stale window; without an
  // id the container would query for `undefined` and render an empty profile.
  if (!id) return <Navigate to="/customers" replace />

  return <CustomerDetailContainer customerId={id} onBack={handleBack} />
}
