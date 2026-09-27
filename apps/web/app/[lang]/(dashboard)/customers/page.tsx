import { Suspense } from 'react'
import {
  customersPage as CustomersContainer,
  customersSkeleton as CustomersSkeleton,
} from '@hisabche/ui'

const titles: Record<string, string> = { fa: 'مشتریان', af: 'مشتریان', en: 'Customers' }
const descriptions: Record<string, string> = {
  fa: 'مدیریت حساب مشتریان و بدهی‌ها',
  af: 'مدیریت حساب مشتریان و قرض‌ها',
  en: 'Manage customer accounts and debts',
}
const keywords: Record<string, string[]> = {
  fa: ['مشتریان', 'بدهی', 'طلب', 'حساب'],
  af: ['مشتریان', 'قرض', 'طلب', 'حساب'],
  en: ['customers', 'debt', 'credit', 'accounts'],
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return {
    title: titles[lang] || titles['fa'],
    description: descriptions[lang] || descriptions['fa'],
    keywords: keywords[lang] || keywords['fa'],
    robots: { index: false, follow: false },
  }
}

// The list seeds its role filter from the query string (`useSearchParams`), so
// — like `/invoices` — it renders per request: a prerendered shell has no query
// string, and server and client would build two different tables (React #418).
// This replaces a local `ssr: false` wrapper that did the same job by never
// rendering on the server at all.
export const dynamic = 'force-dynamic'

export default function CustomersPage() {
  return (
    <Suspense fallback={<CustomersSkeleton />}>
      <CustomersContainer />
    </Suspense>
  )
}
