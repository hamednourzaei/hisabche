import { ProductDetailContainer } from "@hisabche/ui"

export function GodamDetailSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center gap-3">
        <div className="skeleton-shimmer h-8 w-8 rounded-lg" />
        <div className="space-y-2">
          <div className="skeleton-shimmer h-8 w-48 rounded-lg" />
          <div className="skeleton-shimmer h-3 w-20 rounded-md" />
        </div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8 space-y-6 backdrop-blur-sm">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="skeleton-shimmer h-4 w-4 rounded-md" />
                <div className="skeleton-shimmer h-3 w-16 rounded-md" />
              </div>
              <div className="skeleton-shimmer h-6 w-24 rounded-lg" />
            </div>
          ))}
        </div>
        <div className="border-t border-white/10 pt-4 grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="skeleton-shimmer h-3 w-16 rounded-md" />
              <div className="skeleton-shimmer h-5 w-20 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center space-y-2 backdrop-blur-sm">
            <div className="skeleton-shimmer h-8 w-20 mx-auto rounded-lg" />
            <div className="skeleton-shimmer h-3 w-16 mx-auto rounded-md" />
          </div>
        ))}
      </div>
    </div>
  )
}

export const metadata = {
  title: "جزئیات محصول | حسابچه",
  robots: { index: false, follow: false },
}

export default function Page() {
  return (
    <main className="section">
      <ProductDetailContainer />
    </main>
  )
}