import { GodamContainer, GodamSkeleton } from "@hisabche/ui"
import { Suspense } from "react"

export const metadata = {
  title: "گدام | حسابچه",
  description: "مدیریت محصولات و موجودی انبار",
  robots: { index: false, follow: false },
}

export default function GodamPage() {
  return (
    <main className="section">
      <Suspense fallback={<GodamSkeleton />}>
        <GodamContainer />
      </Suspense>
    </main>
  )
}