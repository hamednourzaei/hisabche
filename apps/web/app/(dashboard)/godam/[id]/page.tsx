import dynamic from "next/dynamic"

export function GodamDetailSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center gap-3">
        <div className="skeleton-shimmer h-8 w-8" />
        <div className="space-y-2">
          <div className="skeleton-shimmer h-8 w-48" />
          <div className="skeleton-shimmer h-3 w-20" />
        </div>
      </div>

      <div className="glass-card p-6 sm:p-8 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="skeleton-shimmer h-4 w-4" />
                <div className="skeleton-shimmer h-3 w-16" />
              </div>
              <div className="skeleton-shimmer h-6 w-24" />
            </div>
          ))}
        </div>
        <div className="border-t border-[var(--hisab-border)] pt-4 grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="skeleton-shimmer h-3 w-16" />
              <div className="skeleton-shimmer h-5 w-20" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="interactive-card p-4 text-center space-y-2">
            <div className="skeleton-shimmer h-8 w-20 mx-auto" />
            <div className="skeleton-shimmer h-3 w-16 mx-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}

const ProductDetailPage = dynamic(
  () => import("@hisabche/ui").then((m) => m.ProductDetailPage),
  { loading: () => <GodamDetailSkeleton />, ssr: true }
)

export const metadata = {
  title: "جزئیات محصول | حسابچه",
  robots: { index: false, follow: false },
}

export default function Page() {
  return (
    <main className="section">
      <ProductDetailPage />
    </main>
  )
}