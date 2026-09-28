// apps/web/app/[lang]/(dashboard)/marketplace/page.tsx
import { MarketplaceContainer } from '@hisabche/ui'

const titles: Record<string, string> = {
  fa: 'بازار برنامه‌ها',
  af: 'بازار برنامه‌ها',
  en: 'App marketplace',
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return { title: titles[lang] || titles.fa }
}

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { app } = await searchParams
  return <MarketplaceContainer initialApp={typeof app === 'string' ? app : undefined} />
}
