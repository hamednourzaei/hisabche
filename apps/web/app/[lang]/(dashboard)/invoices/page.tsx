import { SalesHubContainer, InvoicesSkeleton } from '@hisabche/ui'
import { Suspense } from 'react'

const titles: Record<string, string> = {
  fa: 'فاکتورها',
  af: 'فاکتورها',
  en: 'Invoices',
}

const descriptions: Record<string, string> = {
  fa: 'مدیریت فاکتورها، فروش، پرداخت‌ها و بدهی مشتریان در حسابچه. صدور فاکتور آنلاین و آفلاین.',
  af: 'مدیریت فاکتورها، فروشات، پرداخت‌ها و قرض مشتریان در حسابچه. صدور فاکتور آنلاین و آفلاین.',
  en: 'Manage invoices, sales, payments and customer debts in Hisabche. Online and offline invoicing.',
}

const keywords: Record<string, string[]> = {
  fa: [
    'فاکتور',
    'صدور فاکتور',
    'فاکتور فروش',
    'مدیریت فاکتور',
    'پرداخت',
    'بدهی مشتری',
    'فاکتور آنلاین',
    'فاکتور آفلاین',
    'حسابچه',
    'صورتحساب',
  ],
  af: [
    'فاکتور',
    'صدور فاکتور',
    'فاکتور فروش',
    'مدیریت فاکتور',
    'پرداخت',
    'قرض مشتری',
    'فاکتور آنلاین',
    'فاکتور آفلاین',
    'حسابچه',
    'صورتحساب',
  ],
  en: [
    'invoice',
    'create invoice',
    'sales invoice',
    'invoice management',
    'payment',
    'customer debt',
    'online invoice',
    'offline invoice',
    'hisabche',
    'bill',
  ],
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

// H1 fix — rendered per request, not prerendered.
//
// The list now seeds its filters from the query string, so `/invoices` and
// `/invoices?type=sale&outstanding=true` are two different tables. A
// prerendered shell has no query string: the server would build the unfiltered
// table and the client the filtered one, and hydration would find two trees
// (React #418) — the same failure `/warehouse?tab=products` had.
//
// The <Suspense> boundary below already covers Next's `useSearchParams`
// requirement. This is the second half: it makes the SERVER see the real URL
// rather than opting the boundary out of prerendering and hoping.
//
// Nothing is lost — an authenticated, per-workspace dashboard page was never
// cacheable as static HTML.
export const dynamic = 'force-dynamic'

export default function InvoicesPage() {
  return (
    <Suspense fallback={<InvoicesSkeleton />}>
      <SalesHubContainer />
    </Suspense>
  )
}
