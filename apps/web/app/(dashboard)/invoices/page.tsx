import { InvoicesContainer } from "@hisabche/ui"

export const metadata = {
  title: "فاکتورها | حسابچه",
  description: "مدیریت فاکتورها و فروش",
  robots: { index: false, follow: false },
}

export default function Page() {
  return (
    <main className="section">
      <InvoicesContainer />
    </main>
  )
}