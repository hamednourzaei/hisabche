// apps/web/app/[lang]/(dashboard)/market-seller/page.tsx
import { redirect } from 'next/navigation'
import { MarketSellerContainer } from '@hisabche/ui'
import { isPageDisabled } from '@hisabche/ui-contract'

const titles: Record<string, string> = {
  fa: 'فروشگاه من در بازار',
  af: 'فروشگاه من در بازار',
  en: 'My marketplace shop',
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return { title: titles[lang] || titles['fa'], robots: { index: false, follow: false } }
}

// Switched off in `DISABLED_PAGES` (ui-contract): the page stays, its door is closed.
export default async function MarketSellerPage({ params }: { params: Promise<{ lang: string }> }) {
  if (isPageDisabled('/market-seller')) redirect(`/${(await params).lang}/dashboard`)
  return <MarketSellerContainer />
}
