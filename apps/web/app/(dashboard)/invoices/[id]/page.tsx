import dynamic from "next/dynamic"

export function InvoiceDetailSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center gap-3">
        <div className="skeleton-shimmer h-8 w-8 rounded-lg" />
        <div className="space-y-2">
          <div className="skeleton-shimmer h-8 w-48 rounded-lg" />
          <div className="skeleton-shimmer h-5 w-20 rounded-lg" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="skeleton-shimmer h-9 w-20 rounded-xl" />
        ))}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8 space-y-6 backdrop-blur-sm">
        <div className="flex justify-between">
          <div className="space-y-2">
            <div className="skeleton-shimmer h-8 w-32 rounded-lg" />
            <div className="skeleton-shimmer h-4 w-24 rounded-md" />
          </div>
          <div className="text-right space-y-2">
            <div className="skeleton-shimmer h-8 w-24 rounded-lg" />
            <div className="skeleton-shimmer h-4 w-20 rounded-md" />
          </div>
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex gap-4">
              <div className="skeleton-shimmer h-4 w-8 rounded-md" />
              <div className="skeleton-shimmer h-4 flex-1 rounded-md" />
              <div className="skeleton-shimmer h-4 w-16 rounded-md" />
              <div className="skeleton-shimmer h-4 w-20 rounded-md" />
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