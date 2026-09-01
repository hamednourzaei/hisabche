// apps/web/app/[lang]/(dashboard)/customer-list/page.tsx
import { CustomerListContainer } from '@hisabche/ui'

const titles: Record<string, string> = {
  fa: 'فهرست مشتریان',
  af: 'فهرست مشتریان',
  en: 'Customer list',
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return { title: titles[lang] || titles['fa'] }
}

export default function CustomerListPage() {
  return <CustomerListContainer />
}
