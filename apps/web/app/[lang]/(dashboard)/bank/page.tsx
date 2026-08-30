// apps/web/app/[lang]/(dashboard)/bank/page.tsx
//
// Thin by design: metadata, then the shared container. Every query, every
// piece of state and every rule lives in `@hisabche/ui`, so desktop mounts
// exactly this screen from its own router without a second implementation.
import { BankContainer } from '@hisabche/ui'

const titles: Record<string, string> = {
  fa: 'مغایرت‌گیری بانکی',
  af: 'مغایرت‌گیری بانکی',
  en: 'Bank reconciliation',
}

const keywords: Record<string, string[]> = {
  fa: ['مغایرت بانکی', 'صورتحساب بانک', 'تطبیق بانکی'],
  af: ['مغایرت بانکی', 'صورتحساب بانک', 'تطبیق بانکی'],
  en: ['bank reconciliation', 'bank statement', 'matching'],
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return {
    title: titles[lang] || titles['fa'],
    keywords: keywords[lang] || keywords['fa'],
  }
}

export default function BankPage() {
  return <BankContainer />
}
