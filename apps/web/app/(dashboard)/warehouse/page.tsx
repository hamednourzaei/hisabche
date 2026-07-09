import { WarehouseContainer, WarehouseSkeleton } from "@hisabche/ui"
import { Suspense } from "react"

export const metadata = {
  title: "گدام | حسابچه",
  description: "مدیریت محصولات و موجودی انبار",
  robots: { index: false, follow: false },
}

export default function WarehousePage() {
  return (
    <main className="section">
      <Suspense fallback={<WarehouseSkeleton />}>
        <WarehouseContainer />
      </Suspense>
    </main>
  )
}