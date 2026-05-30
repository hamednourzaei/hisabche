import { ProductDetailContainer } from "@hisabche/ui"

export const metadata = {
  title: "جزئیات محصول | حسابچه",
  robots: { index: false, follow: false },
}

export default function Page() {
  return (
    <main className="section">
      <ProductDetailContainer />
    </main>
  )
}