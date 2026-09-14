// apps/web/app/[lang]/(dashboard)/governance/page.tsx
import { GovernanceHubContainer } from '@hisabche/ui'

const titles: Record<string, string> = {
  fa: 'تفکیک وظایف',
  af: 'تفکیک وظایف',
  en: 'Separation of duties',
}

const keywords: Record<string, string[]> = {
  fa: ['تفکیک وظایف', 'کنترل داخلی', 'حاکمیت', 'تقلب'],
  af: ['تفکیک وظایف', 'کنترل داخلی', 'حاکمیت', 'تقلب'],
  en: ['separation of duties', 'internal control', 'governance', 'fraud'],
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return {
    title: titles[lang] || titles['fa'],
    keywords: keywords[lang] || keywords['fa'],
  }
}

export default function GovernancePage() {
  return <GovernanceHubContainer />
}
