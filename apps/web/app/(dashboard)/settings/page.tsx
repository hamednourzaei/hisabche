import dynamic from "next/dynamic"

export function SettingsSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 animate-fade-in-up">
      <div className="space-y-2">
        <div className="skeleton-shimmer h-8 w-32" />
        <div className="skeleton-shimmer h-4 w-64" />
      </div>

      {/* Account card */}
      <div className="glass-card p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="skeleton-shimmer h-12 w-12" />
          <div className="space-y-2">
            <div className="skeleton-shimmer h-5 w-32" />
            <div className="skeleton-shimmer h-4 w-40" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="skeleton-shimmer h-16" />
          <div className="skeleton-shimmer h-16" />
        </div>
        <div className="skeleton-shimmer h-10 w-32" />
      </div>

      {/* 4 more cards */}
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="glass-card p-6 space-y-5">
          <div className="flex items-center gap-2">
            <div className="skeleton-shimmer h-5 w-5" />
            <div className="skeleton-shimmer h-5 w-32" />
          </div>
          <div className="skeleton-shimmer h-16" />
          <div className="grid grid-cols-3 gap-3">
            <div className="skeleton-shimmer h-9" />
            <div className="skeleton-shimmer h-9" />
            <div className="skeleton-shimmer h-9" />
          </div>
        </div>
      ))}
    </div>
  )
}

const SettingsPage = dynamic(
  () => import("@hisabche/ui/settings/settings-page").then((m) => m.SettingsPage),
  { loading: () => <SettingsSkeleton />, ssr: true }
)

export const metadata = {
  title: "تنظیمات | حسابچه",
  robots: { index: false, follow: false },
}

export default function Page() {
  return (
    <main className="section">
      <SettingsPage />
    </main>
  )
}