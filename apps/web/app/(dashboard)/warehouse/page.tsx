// apps/web/app/(dashboard)/warehouse/page.tsx
import { warehouseContainer, warehouseSkeleton } from "@hisabche/ui"
import { Suspense } from "react"

export const metadata = {
  title: "انبار | حسابچه",
  description: "مدیریت انبار و موجودی کالا",
}

export default function WarehousePage() {
  return (
    <Suspense fallback={warehouseSkeleton()}>
      {warehouseContainer()}
    </Suspense>
  )
}