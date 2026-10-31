// apps/web/app/[lang]/(dashboard)/developers/page.tsx
import { DevelopersContainer } from '@hisabche/ui'

const titles: Record<string, string> = {
  fa: 'توسعه‌دهندگان و اتصال‌ها',
  af: 'توسعه‌دهندگان و اتصال‌ها',
  en: 'Developers and integrations',
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return { title: titles[lang] || titles.fa }
}

export default function DevelopersPage() {
  return <DevelopersContainer />
}
