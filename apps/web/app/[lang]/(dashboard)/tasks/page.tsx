// apps/web/app/[lang]/(dashboard)/tasks/page.tsx
import { CrmContainer } from '@hisabche/ui'

const titles: Record<string, string> = {
  fa: 'ارتباط با مشتریان',
  af: 'ارتباط با مشتریان',
  en: 'CRM',
}

const keywords: Record<string, string[]> = {
  fa: ['ارتباط با مشتریان', 'تعاملات', 'فرصت‌های فروش', 'CRM'],
  af: ['ارتباط با مشتریان', 'تعاملات', 'فرصت‌های فروش', 'CRM'],
  en: ['crm', 'interactions', 'sales opportunities', 'pipeline'],
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return {
    title: titles[lang] || titles['fa'],
    keywords: keywords[lang] || keywords['fa'],
  }
}

export default function CrmPage() {
  return <CrmContainer />
}
