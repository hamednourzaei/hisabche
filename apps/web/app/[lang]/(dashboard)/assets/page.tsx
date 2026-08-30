// apps/web/app/[lang]/(dashboard)/assets/page.tsx
//
// Thin by design: metadata, then the shared container. Every query, every
// piece of state and every rule lives in `@hisabche/ui`, so desktop mounts
// exactly this screen from its own router without a second implementation.
import { AssetsContainer } from '@hisabche/ui'

const titles: Record<string, string> = {
  fa: 'دارایی‌های ثابت',
  af: 'دارایی‌های ثابت',
  en: 'Fixed assets',
}

const keywords: Record<string, string[]> = {
  fa: ['دارایی ثابت', 'استهلاک', 'ارزش دفتری', 'واگذاری دارایی'],
  af: ['دارایی ثابت', 'استهلاک', 'ارزش دفتری', 'واگذاری دارایی'],
  en: ['fixed assets', 'depreciation', 'book value', 'disposal'],
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return {
    title: titles[lang] || titles['fa'],
    keywords: keywords[lang] || keywords['fa'],
  }
}

export default function AssetsPage() {
  return <AssetsContainer />
}
