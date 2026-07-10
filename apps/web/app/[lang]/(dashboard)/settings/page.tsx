import { SettingsPage } from "@hisabche/ui"

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