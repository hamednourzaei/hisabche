// apps/web/app/[lang]/(dashboard)/marketplace/page.tsx
import { redirect } from 'next/navigation'
import { MarketplaceContainer } from '@hisabche/ui'
import { isPageDisabled } from '@hisabche/ui-contract'

const titles: Record<string, string> = {
  fa: 'بازار برنامه‌ها',
  af: 'بازار برنامه‌ها',
  en: 'App marketplace',
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return { title: titles[lang] || titles.fa }
}

// Switched off in `DISABLED_PAGES` (ui-contract): the page stays, its door is closed.
export default async function MarketplacePage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  if (isPageDisabled('/marketplace')) redirect(`/${(await params).lang}/settings`)
  const { app } = await searchParams
  return <MarketplaceContainer initialApp={typeof app === 'string' ? app : undefined} />
}
