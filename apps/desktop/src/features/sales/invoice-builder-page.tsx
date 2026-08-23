// ============================================
// STEP 1 of invoice creation — the same shared container web mounts at
// /invoices/new. The route path matches web's exactly so the container's
// `router.push('/invoices/new/preview')` works unmodified on both.
// ============================================

import React from 'react'
import { InvoiceBuilderContainer } from '@hisabche/ui/screens'

export default function InvoiceBuilderPage() {
  return <InvoiceBuilderContainer />
}
