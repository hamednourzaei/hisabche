// ============================================
// Invoice list.
//
// Renders the shared screen — the same module the web app mounts at
// `/invoices`, including the sale/purchase filter and both transaction types.
// Desktop no longer keeps its own sales-only table.
// ============================================

import React from 'react'
import { InvoicesContainer } from '@hisabche/ui/screens'

export default function InvoicesPage() {
  return <InvoicesContainer />
}
