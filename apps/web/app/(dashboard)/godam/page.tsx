import { GodamClient } from "./godam-client"

export const metadata = {
  title: "گدام | حسابچه",
  description: "مدیریت محصولات و موجودی انبار",
  robots: { index: false, follow: false },
}

export default function Page() {
  return (
    <main className="section">
      <GodamClient />
    </main>
  )
}