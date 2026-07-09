import { CustomersClient } from "./customers-client"

export const metadata = {
  title: "مشتریان | حسابچه",
  description: "مدیریت حساب مشتریان و بدهی‌ها",
  robots: { index: false, follow: false },
}

export default function Page() {
  return (
    <main className="section">
      <CustomersClient />
    </main>
  )
}