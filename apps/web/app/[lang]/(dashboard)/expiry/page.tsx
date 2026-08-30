// apps/web/app/[lang]/(dashboard)/expiry/page.tsx
//
// Thin by design: metadata, then the shared container. Every query, every
// piece of state and every rule lives in `@hisabche/ui`, so desktop mounts
// exactly this screen from its own router without a second implementation.
import { ExpiryContainer } from '@hisabche/ui'

const titles: Record<string, string> = {
  fa: 'انقضا و بچ',
  af: 'انقضا و بچ',
  en: 'Expiry and batches',
}

const keywords: Record<string, string[]> = {
  fa: ['انقضا', 'بچ', 'سریال', 'FEFO', 'کالای منقضی'],
  af: ['انقضا', 'بچ', 'سریال', 'FEFO', 'کالای منقضی'],
  en: ['expiry', 'batch', 'lot', 'serial', 'fefo', 'shelf life'],
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return {
    title: titles[lang] || titles['fa'],
    keywords: keywords[lang] || keywords['fa'],
  }
}

export default function ExpiryPage() {
  return <ExpiryContainer />
}
