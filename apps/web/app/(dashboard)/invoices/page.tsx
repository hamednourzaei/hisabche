import { InvoicesContainer, InvoicesSkeleton } from "@hisabche/ui"
import { Suspense } from "react"

export const metadata = {
  title: "فاکتورها | حسابچه",
  description: "مدیریت فاکتورها و فروش",
  robots: { index: false, follow: false },
}

export default function InvoicesPage() {
  return (
    <main className="section">
      <Suspense fallback={<InvoicesSkeleton />}>
        <InvoicesContainer />
      </Suspense>
    </main>
  )
}