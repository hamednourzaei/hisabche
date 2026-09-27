// apps/web/app/[lang]/(dashboard)/warehouse/page.tsx
import { Suspense } from 'react'
import { WarehouseTabsContainer, warehouseSkeleton as WarehouseSkeleton } from '@hisabche/ui'

const titles: Record<string, string> = { fa: 'انبار', af: 'گدام', en: 'Warehouse' }
const descriptions: Record<string, string> = {
  fa: 'مدیریت انبار و موجودی',
  af: 'مدیریت گدام و موجودی',
  en: 'Warehouse & inventory management',
}
const keywords: Record<string, string[]> = {
  fa: ['انبار', 'موجودی', 'کالا'],
  af: ['گدام', 'موجودی', 'جنس'],
  en: ['warehouse', 'inventory', 'stock'],
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return {
    title: titles[lang] || titles['fa'],
    description: descriptions[lang] || descriptions['fa'],
    keywords: keywords[lang] || keywords['fa'],
  }
}

// G1 fix — rendered per request, not prerendered.
//
// The tab is chosen by `?tab=products`. A prerendered shell has no query string,
// so the server would build the stock tab and the client would build the
// catalogue, and hydration would find two different trees (React #418, "text
// content does not match"). Rendering on request means the server sees the real
// URL and both sides agree.
//
// Nothing is lost: this is an authenticated dashboard page whose contents are
// per-workspace, so it was never cacheable as static HTML.
export const dynamic = 'force-dynamic'

// The tabs (stock and the product catalogue, where `/product-list` redirects)
// live in `@hisabche/ui` so desktop has them too. The boundary is here rather
// than inside the container: `useSearchParams` suspends, and the container
// reads it.
export default function WarehousePage() {
  return (
    <main className="section">
      <Suspense fallback={<WarehouseSkeleton />}>
        <WarehouseTabsContainer />
      </Suspense>
    </main>
  )
}
