// apps/web/app/[lang]/(dashboard)/campaigns/page.tsx
import { CampaignsContainer } from '@hisabche/ui'

const titles: Record<string, string> = {
  fa: 'کمپین‌ها',
  af: 'کمپاین‌ها',
  en: 'Campaigns',
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return { title: titles[lang] || titles['fa'], robots: { index: false, follow: false } }
}

export default function CampaignsPage() {
  return <CampaignsContainer />
}
