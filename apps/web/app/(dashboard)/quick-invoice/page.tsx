import dynamic from "next/dynamic"

function QuickInvoiceSkeleton() {
  return (
    <div className="hisab-root px-4 py-10">
      <div className="mx-auto max-w-xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="skeleton-shimmer h-3 w-3 rounded-full" />
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton-shimmer h-2 w-14 rounded-md" />
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-6 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <div className="skeleton-shimmer h-16 w-16 rounded-2xl" />
            <div className="skeleton-shimmer h-8 w-32 rounded-lg" />
            <div className="skeleton-shimmer h-4 w-48 rounded-md" />
          </div>
          <div className="skeleton-shimmer h-12 w-full rounded-xl" />
          <div className="skeleton-shimmer h-10 w-full rounded-xl" />
        </div>
      </div>
    </div>
  )
}

const QuickInvoicePage = dynamic(
  () => import("@hisabche/ui/quick-invoice/quick-invoice-page").then((m) => m.QuickInvoicePage),
  { loading: () => <QuickInvoiceSkeleton />, ssr: true }
)

export const metadata = {
  title: "فاکتور سریع | حسابچه",
  description: "ثبت فاکتور در کمتر از ۳۰ ثانیه",
  robots: { index: false, follow: false },
}

export default function Page() {
  return (
    <main className="section">
      <QuickInvoicePage />
    </main>
  )
}