import { InvoiceDetailContainer } from "@hisabche/ui"

export const metadata = {
  title: "جزئیات فاکتور | حسابچه",
  robots: { index: false, follow: false },
}

export default function Page() {
  return (
    <main className="section">
      <InvoiceDetailContainer />
    </main>
  )
}