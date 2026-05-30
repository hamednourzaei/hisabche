import { QuickInvoiceContainer } from "@hisabche/ui"

export const metadata = {
  title: "فاکتور سریع | حسابچه",
  description: "ثبت فاکتور در کمتر از ۳۰ ثانیه",
  robots: { index: false, follow: true },
}

export default function Page() {
  return (
    <main className="section">
      <QuickInvoiceContainer />
    </main>
  )
}