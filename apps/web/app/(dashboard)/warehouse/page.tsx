// apps/web/app/(dashboard)/warehouse/page.tsx
"use client"

import { warehouseContainer, warehouseSkeleton } from "@hisabche/ui"
import { Suspense } from "react"

export default function WarehousePage() {
  return (
    <Suspense fallback={warehouseSkeleton()}>
      {warehouseContainer()}
    </Suspense>
  )
}