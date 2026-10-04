// apps/web/app/[lang]/(dashboard)/promotions/page.tsx
import { PromotionsContainer } from '@hisabche/ui'

const titles: Record<string, string> = {
  fa: 'تخفیف‌ها',
  af: 'تخفیف‌ها',
  en: 'Promotions',
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return { title: titles[lang] || titles['fa'], robots: { index: false, follow: false } }
}

export default function PromotionsPage() {
  return <PromotionsContainer />
}
