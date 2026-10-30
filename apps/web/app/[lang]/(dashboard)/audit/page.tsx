// apps/web/app/[lang]/(dashboard)/audit/page.tsx
import { AuditContainer } from '@hisabche/ui'

const titles: Record<string, string> = {
  fa: 'سابقه تغییرات',
  af: 'سابقه تغییرات',
  en: 'Audit Log',
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return {
    title: titles[lang] || titles.fa,
    robots: { index: false, follow: false },
  }
}

export default function AuditPage() {
  return <AuditContainer />
}
