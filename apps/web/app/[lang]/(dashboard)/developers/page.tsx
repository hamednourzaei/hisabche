// apps/web/app/[lang]/(dashboard)/developers/page.tsx
import { redirect } from 'next/navigation'
import { DevelopersContainer } from '@hisabche/ui'
import { isPageDisabled } from '@hisabche/ui-contract'

const titles: Record<string, string> = {
  fa: 'توسعه‌دهندگان و اتصال‌ها',
  af: 'توسعه‌دهندگان و اتصال‌ها',
  en: 'Developers and integrations',
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return { title: titles[lang] || titles.fa }
}

// Switched off in `DISABLED_PAGES` (ui-contract): the page stays, its door is closed.
export default async function DevelopersPage({ params }: { params: Promise<{ lang: string }> }) {
  if (isPageDisabled('/developers')) redirect(`/${(await params).lang}/settings`)
  return <DevelopersContainer />
}
