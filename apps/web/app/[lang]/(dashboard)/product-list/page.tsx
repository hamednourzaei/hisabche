// apps/web/app/[lang]/(dashboard)/product-list/page.tsx
import { ProductListContainer } from '@hisabche/ui'

const titles: Record<string, string> = {
  fa: 'فهرست کالاها',
  af: 'فهرست کالاها',
  en: 'Product list',
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return { title: titles[lang] || titles['fa'] }
}

export default function Page() {
  return <ProductListContainer />
}
