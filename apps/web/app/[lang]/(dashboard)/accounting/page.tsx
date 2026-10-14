// apps/web/app/[lang]/(dashboard)/accounting/page.tsx
import { AccountingPage } from '@hisabche/ui'

// Without its own title the tab read «داشبورد» — the group's default (live audit #17).
const titles: Record<string, string> = { fa: 'پول و سود', af: 'پول و سود', en: 'Money & Profit' }

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return { title: titles[lang] || titles['fa'], robots: { index: false, follow: false } }
}

export default function Page() {
  return <AccountingPage />
}
