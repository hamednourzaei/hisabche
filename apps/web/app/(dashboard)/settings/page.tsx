import dynamic from "next/dynamic"

export function SettingsSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 animate-fade-in-up">
      <div className="space-y-2">
        <div className="skeleton-shimmer h-8 w-32 rounded-lg" />
        <div className="skeleton-shimmer h-4 w-64 rounded-lg" />
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-5 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="skeleton-shimmer h-12 w-12 rounded-xl" />
          <div className="space-y-2">
            <div className="skeleton-shimmer h-5 w-32 rounded-md" />
            <div className="skeleton-shimmer h-4 w-40 rounded-md" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="skeleton-shimmer h-16 rounded-xl" />
          <div className="skeleton-shimmer h-16 rounded-xl" />
        </div>
        <div className="skeleton-shimmer h-10 w-32 rounded-xl" />
      </div>

      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-5 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="skeleton-shimmer h-5 w-5 rounded-md" />
            <div className="skeleton-shimmer h-5 w-32 rounded-md" />
          </div>
          <div className="skeleton-shimmer h-16 rounded-xl" />
          <div className="grid grid-cols-3 gap-3">
            <div className="skeleton-shimmer h-9 rounded-xl" />
            <div className="skeleton-shimmer h-9 rounded-xl" />
            <div className="skeleton-shimmer h-9 rounded-xl" />
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