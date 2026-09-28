// apps/web/app/[lang]/(dashboard)/orders/page.tsx
import { OrdersContainer } from '@hisabche/ui'

const titles: Record<string, string> = {
  fa: 'سفارش‌ها',
  af: 'سفارش‌ها',
  en: 'Orders',
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return { title: titles[lang] || titles.fa }
}

export default function OrdersPage() {
  return <OrdersContainer />
}
