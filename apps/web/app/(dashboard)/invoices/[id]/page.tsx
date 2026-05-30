import dynamic from "next/dynamic"

export function InvoiceDetailSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center gap-3">
        <div className="skeleton-shimmer h-8 w-8" />
        <div className="space-y-2">
          <div className="skeleton-shimmer h-8 w-48" />
          <div className="skeleton-shimmer h-5 w-20" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="skeleton-shimmer h-9 w-20" />
        ))}
      </div>

      <div className="glass-card p-6 sm:p-8 space-y-6">
        <div className="flex justify-between">
          <div className="space-y-2">
            <div className="skeleton-shimmer h-8 w-32" />
            <div className="skeleton-shimmer h-4 w-24" />
          </div>
          <div className="text-right space-y-2">
            <div className="skeleton-shimmer h-8 w-24" />
            <div className="skeleton-shimmer h-4 w-20" />
          </div>
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex gap-4">
              <div className="skeleton-shimmer h-4 w-8" />
              <div className="skeleton-shimmer h-4 flex-1" />
              <div className="skeleton-shimmer h-4 w-16" />
              <div className="skeleton-shimmer h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const InvoiceDetailPage = dynamic(
  () => import("@hisabche/ui").then((m) => m.InvoiceDetailPage),
  { loading: () => <InvoiceDetailSkeleton />, ssr: true }
)

export const metadata = {
  title: "جزئیات فاکتور | حسابچه",
  robots: { index: false, follow: false },
}

export default function Page() {
  return (
    <main className="section">
      <InvoiceDetailPage />
    </main>
  )
}