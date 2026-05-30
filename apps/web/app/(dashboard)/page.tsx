import { DashboardClient } from "./dashboard/dashboard-client"

export const dynamic = 'force-dynamic'

export const metadata = {
  title: "داشبورد | حسابچه",
  description: "نمای کلی کسب‌وکار",
  robots: { index: false, follow: false },
}

export default function Page() {
  return (
    <main className="section">
      <DashboardClient />
    </main>
  )
}