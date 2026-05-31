import { BaqidariClient } from "./baqidari-client"

export const metadata = {
  title: "باقی‌داری | حسابچه",
  description: "مدیریت حساب مشتریان و بدهی‌ها",
  robots: { index: false, follow: false },
}

export default function Page() {
  return (
    <main className="section">
      <BaqidariClient />
    </main>
  )
}