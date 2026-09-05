// ============================================
// Warehouse / inventory.
//
// G1: mounts the two-tab container (موجودی / کاتالوگ کالا) rather than the
// stock list alone, so `/warehouse?tab=products` resolves here exactly as it
// does on web and the deprecated `/product-list` has somewhere to land.
// ============================================

import React from 'react'
import { WarehouseTabsContainer } from '@hisabche/ui/screens'

export default function ProductsPage() {
  return <WarehouseTabsContainer />
}
