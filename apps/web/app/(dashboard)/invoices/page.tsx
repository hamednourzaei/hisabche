import dynamic from "next/dynamic"

const CARD_ITEMS = [1, 2, 3, 4, 5, 6] as const

export function InvoicesSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="skeleton-shimmer h-8 w-32" />
          <div className="skeleton-shimmer h-4 w-48" />
        </div>
        <div className="skeleton-shimmer h-10 w-32" />
      </div>

      <div className="flex gap-2">
        <div className="skeleton-shimmer h-10 w-64" />
        <div className="skeleton-shimmer h-10 w-24" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {CARD_ITEMS.map((i) => (
          <div key={i} className="glass-card p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="skeleton-shimmer h-11 w-11" />
                <div className="space-y-2">
                  <div className="skeleton-shimmer h-4 w-20" />
                  <div className="skeleton-shimmer h-3 w-16" />
                </div>
              </div>
              <div className="skeleton-shimmer h-5 w-16" />
            </div>
            <div className="space-y-2">
              <div className="skeleton-shimmer h-3 w-12" />
              <div className="skeleton-shimmer h-8 w-28" />
            </div>
            <div className="flex justify-end gap-2">
              <div className="skeleton-shimmer h-9 w-9" />
              <div className="skeleton-shimmer h-9 w-9" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const InvoicesPage = dynamic(
  () => import("@hisabche/ui").then((m) => m.InvoicesPage),
  { loading: () => <InvoicesSkeleton />, ssr: true }
)

export const metadata = {
  title: "فاکتورها | حسابچه",
  description: "مدیریت فاکتورها و فروش",
  robots: { index: false, follow: false },
}

export default function Page() {
  return (
    <main className="section">
      <InvoicesPage />
    </main>
  )
}