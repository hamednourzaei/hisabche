import dynamic from "next/dynamic"

const WorkspacePage = dynamic(
  () => import("@hisabche/ui").then((m) => m.WorkspacePage),
  { loading: () => <div className="skeleton-shimmer h-64" />, ssr: true }
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