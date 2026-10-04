// apps/web/app/[lang]/(dashboard)/analysis/page.tsx
import { AnalysisContainer } from '@hisabche/ui'

const titles: Record<string, string> = {
  fa: 'تحلیل کسب‌وکار',
  af: 'تحلیل کسب‌وکار',
  en: 'Business analysis',
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return { title: titles[lang] || titles['fa'], robots: { index: false, follow: false } }
}

export default function AnalysisPage() {
  return <AnalysisContainer />
}
