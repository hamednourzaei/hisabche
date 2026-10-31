// apps/web/app/[lang]/(dashboard)/market-seller/page.tsx
import { MarketSellerContainer } from '@hisabche/ui'

const titles: Record<string, string> = {
  fa: 'فروشگاه من در بازار',
  af: 'فروشگاه من در بازار',
  en: 'My marketplace shop',
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return { title: titles[lang] || titles['fa'], robots: { index: false, follow: false } }
}

export default function MarketSellerPage() {
  return <MarketSellerContainer />
}
