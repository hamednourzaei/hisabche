// apps/web/app/[lang]/(dashboard)/till/page.tsx
//
// Thin by design: metadata, then the shared container. Every query, every
// piece of state and every rule lives in `@hisabche/ui`, so desktop mounts
// exactly this screen from its own router without a second implementation.
import { TillContainer } from '@hisabche/ui'

const titles: Record<string, string> = {
  fa: 'صندوق',
  af: 'صندوق',
  en: 'Till',
}

const keywords: Record<string, string[]> = {
  fa: ['صندوق', 'فروش نقدی', 'شمارش صندوق', 'کسری صندوق'],
  af: ['صندوق', 'فروش نقدی', 'شمارش صندوق', 'کسری صندوق'],
  en: ['till', 'cash drawer', 'pos session', 'cash count', 'variance'],
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return {
    title: titles[lang] || titles['fa'],
    keywords: keywords[lang] || keywords['fa'],
  }
}

export default function TillPage() {
  return <TillContainer />
}
