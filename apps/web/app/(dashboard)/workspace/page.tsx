// apps/web/app/(dashboard)/workspace/page.tsx
import dynamic from "next/dynamic"

const WorkspacePage = dynamic(
  () => import("@hisabche/ui").then((m) => m.WorkspacePage),
  {
    loading: () => (
      <div className="space-y-6 p-6">
        <div className="skeleton-shimmer h-8 w-48 rounded-lg" />
        <div className="skeleton-shimmer h-64 rounded-2xl" />
        <div className="skeleton-shimmer h-48 rounded-2xl" />
      </div>
    ),
    ssr: true,
  }
)

export const metadata = {
  title: "ورک‌اسپیس | حسابچه",
  robots: { index: false, follow: false },
}

export default function Page() {
  return (
    <main className="section">
      <WorkspacePage />
    </main>
  )
}