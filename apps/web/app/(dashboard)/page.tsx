import { DashboardContainer } from "@hisabche/ui"

export const metadata = {
  title: "داشبورد | حسابچه",
  description: "نمای کلی کسب‌وکار",
  robots: { index: false, follow: false },
}

export default function Page() {
  return (
    <main className="section">
      <DashboardContainer />
    </main>
  )
}